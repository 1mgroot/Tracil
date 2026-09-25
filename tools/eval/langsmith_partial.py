#!/usr/bin/env python3
"""Eight partial parser cases through LangSmith evaluate; local by default."""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
from unittest.mock import patch
from uuid import NAMESPACE_URL, uuid5
import dataset_tool as data
import define_adapter
import run_ars
from langsmith_dataset import exact_json_evaluator, SDK_VERSION

ROOT=Path(__file__).resolve().parents[2]
CASE_IDS=tuple(define_adapter.PROJECTIONS)+tuple(run_ars.CASES)
FILES={'define_adam':'define.xml',**run_ars.FILES}


def specs(cid):
    if cid in define_adapter.PROJECTIONS:
        return define_adapter.project(cid,{})
    return run_ars.project(cid,{})


def key(check):
    return json.dumps(check['reference_path'],separators=(',',':'))


def evaluate_fields(outputs, reference_outputs):
    expected=reference_outputs['fields']
    actual=(outputs or {}).get('fields',{})
    passed=0
    for name,value in expected.items():
        item=actual.get(name,{})
        passed += bool(item.get('present')) and bool(exact_json_evaluator(
            {'answer':item.get('value')},{'answer':value,'grading':{'method':'exact_json'}})['score'])
    return [{'key':'partial_field_accuracy','score':passed/len(expected)},
            {'key':'partial_fields_passed','score':passed},
            {'key':'partial_fields_total','score':len(expected)},
            {'key':'all_selected_fields_match','score':int(passed==len(expected))}]


def make_target(bundle):
    # Target closure contains source paths and parser code only, never references.
    sys.path.insert(0,str(ROOT/'backend'))
    import main
    from services.tlf_index import parse_ars
    def target(inputs):
        if set(inputs)!={'case_id'} or inputs['case_id'] not in CASE_IDS:
            raise ValueError('Unknown case or unexpected target input fields')
        cid=inputs['case_id']
        if cid in define_adapter.PROJECTIONS:
            checks=define_adapter.project(cid,main.parse_define_minimal(bundle.parent/'define.xml'))
        else:
            sid=run_ars.CASES[cid][0]
            checks=run_ars.project(cid,{sid:parse_ars(bundle.parent/FILES[sid])})
        return {'fields':{key(c):{'present':c['present'],**({'value':c['actual']} if c['present'] else {})} for c in checks}}
    return target


def run(bundle, output, upload=False):
    import langsmith
    from langsmith import Client, evaluate
    from langsmith.schemas import Example
    from dotenv import load_dotenv
    load_dotenv(ROOT/'backend/.env')
    data.require(langsmith.__version__==SDK_VERSION,'SDK version mismatch')
    if upload:
        data.require(bool(os.getenv('LANGSMITH_API_KEY') or os.getenv('LANGCHAIN_API_KEY')),'Missing LANGSMITH_API_KEY')
    with ExitStack() as stack:
        stack.enter_context(patch.dict(os.environ,{'LANGSMITH_TRACING':'false','LANGCHAIN_TRACING_V2':'false'}))
        attempts=[]
        if not upload:
            def blocked(*args,**kwargs):
                attempts.append('blocked'); raise RuntimeError('Local evaluation forbids network')
            for name in ('connect','connect_ex'):
                stack.enter_context(patch.object(socket.socket,name,blocked))
            stack.enter_context(patch.object(socket,'create_connection',blocked))
        data.validate(bundle)
        target=make_target(bundle)
        refs={r['case_id']:r['expected_output'] for r in data.read_lines(bundle/'references/deterministic.jsonl')}
        source_hashes={sid:data.digest(bundle.parent/file) for sid,file in FILES.items()}
        refhash=data.digest(bundle/'references/deterministic.jsonl')
        snapshot=data.canonical({'sources':source_hashes,'reference':refhash,'specs':{cid:specs(cid) for cid in CASE_IDS}})
        identity=str(uuid5(NAMESPACE_URL,snapshot))
        dataset_name='tracil-partial-parser-8-'+identity[:8]
        dataset_id=uuid5(NAMESPACE_URL,dataset_name)
        examples=[]
        for cid in CASE_IDS:
            fields={}
            for check in specs(cid):
                value=refs[cid]
                for component in check['reference_path']: value=value[component]
                fields[key(check)]=value
            examples.append(Example(id=uuid5(dataset_id,cid),dataset_id=dataset_id,
                created_at=datetime(1970,1,1,tzinfo=timezone.utc),inputs={'case_id':cid},
                outputs={'fields':fields},metadata={'coverage':'partial_fields_only','original_case_id':cid}))
        metadata={'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'source_hashes':source_hashes,'reference_sha256':refhash,'coverage':'partial_fields_only',
            'code_hashes':{p:data.digest(ROOT/p) for p in ['backend/main.py','backend/services/tlf_index.py','tools/eval/define_adapter.py','tools/eval/run_ars.py','tools/eval/langsmith_partial.py']}}
        client=Client() if upload else Client(api_url='http://127.0.0.1:9',api_key='local-unused',auto_batch_tracing=False)
        try:
            if upload:
                if client.has_dataset(dataset_name=dataset_name):
                    ds=client.read_dataset(dataset_name=dataset_name)
                    existing=list(client.list_examples(dataset_id=ds.id))
                    wanted={e.inputs['case_id']:e.outputs for e in examples}
                    found={e.inputs['case_id']:e.outputs for e in existing}
                    data.require(len(existing)==8 and data.canonical(wanted)==data.canonical(found),'Cloud snapshot mismatch; refusing overwrite')
                else:
                    ds=client.create_dataset(dataset_name=dataset_name,description='8 partial parser checks; not full original cases. No raw documents.')
                    client.create_examples(dataset_id=ds.id,examples=[{'inputs':e.inputs,'outputs':e.outputs,'metadata':e.metadata} for e in examples])
                evaluation_data=dataset_name
            else:
                evaluation_data=examples
            experiment=evaluate(target,data=evaluation_data,evaluators=[evaluate_fields],client=client,
                upload_results=upload,max_concurrency=0,experiment_prefix='partial-parser-8',metadata=metadata)
            results=[]
            for row in experiment:
                results.append({'case_id':row['example'].inputs['case_id'],'outputs':row['run'].outputs,
                    'error':row['run'].error,'scores':{s.key:s.score for s in row['evaluation_results']['results']}})
            report={'sdk_version':langsmith.__version__,'upload_results':upload,'dataset_name':dataset_name,
                'experiment_name':experiment.experiment_name,'metadata':metadata,'network_attempts':len(attempts) if not upload else None,
                'cases':len(results),'field_passed':sum(r['scores'].get('partial_fields_passed',0) for r in results),
                'field_total':sum(r['scores'].get('partial_fields_total',0) for r in results),
                'full_case_score':None,'results':results}
        finally: client.close()
        data.require(not attempts,'Unexpected network attempt')
    output.mkdir(parents=True,exist_ok=True)
    data.write_json(output/'report.json',report)
    data.require(len(results)==8 and all(not r['error'] and len(r['scores'])==4 for r in results),'Target/evaluator errors; inspect report')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,default=ROOT/'local-test-data/eval-v0')
    parser.add_argument('--output',type=Path,default=ROOT/'local-test-data/test-results/langsmith-partial-8')
    parser.add_argument('--upload',action='store_true',help='Send selected reference fields, outputs, scores and metadata to configured LangSmith workspace; no raw files.')
    args=parser.parse_args()
    r=run(args.bundle.resolve(),args.output.resolve(),args.upload)
    print(json.dumps({k:v for k,v in r.items() if k not in ['results','metadata']},indent=2))
