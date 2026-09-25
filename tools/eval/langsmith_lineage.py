#!/usr/bin/env python3
"""Three live lineage API cases; cloud receives graphs/metrics, never raw prompts."""
import json, os, sys, time, hashlib, subprocess
from pathlib import Path
from contextlib import ExitStack
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import patch
import dataset_tool as data
ROOT=Path(__file__).resolve().parents[2]
SPECS={
 'lineage-advs-chg':{'dataset':'ADVS','variable':'CHG','sources':['define.xml']},
 'lineage-adsl-saffl':{'dataset':'ADSL','variable':'SAFFL','sources':['define.xml']},
 'lineage-adae-aesdisab':{'dataset':'ADAE','variable':'AESDISAB','sources':['define.xml','define-sdtm.xml']}}
REFERENCES={
 'lineage-advs-chg':[['ADVS.AVAL','ADVS.CHG'],['ADVS.BASE','ADVS.CHG']],
 'lineage-adsl-saffl':[['ADSL.ITTFL','ADSL.SAFFL'],['ADSL.TRTSDT','ADSL.SAFFL']],
 'lineage-adae-aesdisab':[['AE.AESDISAB','ADAE.AESDISAB']]}


def score_edges(outputs, reference_outputs):
    graph=(outputs or {}).get('response',{}).get('lineage',{})
    edges={(str(e.get('from','')).upper(),str(e.get('to','')).upper()) for e in graph.get('edges',[])}
    expected={tuple(e) for e in reference_outputs['required_edges']}
    matched=len(edges & expected)
    return [{'key':'required_edge_recall','score':matched/len(expected)},
            {'key':'required_edges_matched','score':matched},
            {'key':'required_edges_total','score':len(expected)},
            {'key':'extra_edges_for_review','score':len(edges-expected)}]


def make_target(folder):
    sys.path.insert(0,str(ROOT/'backend'))
    import main
    from services import llm_lineage_define as builder
    from fastapi.testclient import TestClient
    from openai.resources.chat.completions import Completions
    from openai.resources.embeddings import Embeddings
    def target(inputs):
        cid=inputs.get('case_id'); spec=SPECS.get(cid)
        if spec is None or inputs!={'case_id':cid,**spec}: raise ValueError('Unexpected case input')
        work=folder/cid/'output'; work.mkdir(parents=True,exist_ok=True)
        calls=[]; start=time.monotonic()
        def capture(original,kind):
            def wrapped(self,*args,**kwargs):
                entry={'kind':kind,'requested_model':kwargs.get('model')}; calls.append(entry)
                t=time.monotonic()
                try:
                    response=original(self,*args,**kwargs)
                    entry.update(status='success',actual_model=response.model,
                        request_id=getattr(response,'_request_id',None),
                        usage=response.usage.model_dump() if response.usage else None)
                    return response
                except Exception as exc:
                    entry.update(status='error',error_type=type(exc).__name__); raise
                finally: entry['seconds']=round(time.monotonic()-t,3)
            return wrapped
        with ExitStack() as stack:
            stack.enter_context(patch.object(main,'OUTPUT',work))
            stack.enter_context(patch.object(builder,'OUTPUT_DIR',work))
            stack.enter_context(patch.object(Completions,'create',capture(Completions.create,'chat')))
            stack.enter_context(patch.object(Embeddings,'create',capture(Embeddings.create,'embedding')))
            client=stack.enter_context(TestClient(main.app))
            files=[('files',(name,stack.enter_context((ROOT/'local-test-data'/name).open('rb')),'application/xml')) for name in spec['sources']]
            upload=client.post('/process-files',files=files); upload.raise_for_status()
            if builder._latest_session().parent!=work: raise RuntimeError('Case isolation failed')
            response=client.post('/analyze-variable',json={'dataset':spec['dataset'],'variable':spec['variable'],'files':[]})
            response.raise_for_status(); body=response.json()
        result={'response':body,'model_calls':calls,'seconds':round(time.monotonic()-start,3),
            'review_status':'conditions, provenance and extra edges require review'}
        data.write_json(folder/(cid+'.json'),{'inputs':inputs,**result})
        if any('Lineage service error:' in str(g) for g in body.get('lineage',{}).get('gaps',[])):
            raise RuntimeError('Lineage service returned an error; details retained locally')
        print(cid,'saved',result['seconds'],flush=True)
        return result
    return target


def run():
    from dotenv import load_dotenv
    load_dotenv(ROOT/'backend/.env')
    os.environ['LANGSMITH_TRACING']='false'; os.environ['LANGCHAIN_TRACING_V2']='false'
    from langsmith import Client,evaluate
    data.require(bool(os.getenv('LANGSMITH_API_KEY') or os.getenv('LANGCHAIN_API_KEY')),'Missing LangSmith key')
    data.require(bool(os.getenv('OPENAI_API_KEY')),'Missing OpenAI key')
    sources={name:data.digest(ROOT/'local-test-data'/name) for name in ['define.xml','define-sdtm.xml']}
    identity=hashlib.sha256(data.canonical({'specs':SPECS,'references':REFERENCES,'sources':sources}).encode()).hexdigest()[:12]
    name='tracil-lineage-3-edges-v1-'+identity
    rows=[{'inputs':{'case_id':cid,**spec},'outputs':{'required_edges':REFERENCES[cid]},
           'metadata':{'coverage':'required_edges_only','not_scored':'conditions, provenance, unsupported extra edges'}} for cid,spec in SPECS.items()]
    folder=ROOT/'local-test-data/test-results/langsmith-lineage-3'/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid4().hex[:6])
    folder.mkdir(parents=True)
    sys.path.insert(0,str(ROOT/'backend'))
    from services import llm_lineage_define as builder
    metadata={'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'source_hashes':sources,'harness_sha256':data.digest(Path(__file__)),
        'code_hashes':{p:data.digest(ROOT/p) for p in ['backend/main.py','backend/services/lineage_workflow.py','backend/services/llm_lineage_define.py']},
        'configured_primary':builder.DEFAULT_MODEL,'configured_fallback':builder.FALLBACK_MODEL,
        'chat_parameters':builder._chat_options(builder.DEFAULT_MODEL),'coverage':'required_edges_only',
        'isolation':'Per-case legacy output roots in serial test process; no product isolation claim'}
    client=Client()
    try:
        if client.has_dataset(dataset_name=name):
            ds=client.read_dataset(dataset_name=name)
            existing=list(client.list_examples(dataset_id=ds.id))
            data.require(len(existing)==3 and {data.canonical({'inputs':e.inputs,'outputs':e.outputs}) for e in existing}=={data.canonical({'inputs':r['inputs'],'outputs':r['outputs']}) for r in rows},'Dataset mismatch')
        else:
            ds=client.create_dataset(dataset_name=name,description='Live API lineage baseline, three targets. Edge recall only; extra edges need review. Raw evidence stays local.')
            client.create_examples(dataset_id=ds.id,examples=rows)
        exp=evaluate(make_target(folder),data=name,evaluators=[score_edges],client=client,
            upload_results=True,max_concurrency=0,experiment_prefix='lineage-'+builder.DEFAULT_MODEL,metadata=metadata)
        results=[{'case_id':r['example'].inputs['case_id'],'error':r['run'].error,
            'outputs':r['run'].outputs,'scores':{s.key:s.score for s in r['evaluation_results']['results']}} for r in exp]
        report={'experiment_name':exp.experiment_name,'dataset_name':name,'metadata':metadata,'results':results}
        data.write_json(folder/'report.json',report)
        project=client.read_project(project_name=exp.experiment_name)
        runs=list(client.list_runs(project_id=project.id,is_root=True))
        feedback=list(client.list_feedback(run_ids=[r.id for r in runs]))
        data.write_json(folder/'cloud-verification.json',{'root_runs':len(runs),'feedback':len(feedback),'run_errors':sum(bool(r.error) for r in runs)})
        print('REPORT',folder/'report.json',flush=True)
        print('VERIFIED',len(runs),'runs',len(feedback),'feedback',flush=True)
        data.require(len(results)==3 and all(not r['error'] for r in results),'Some API cases failed; inspect report')
    finally: client.close()

if __name__=='__main__': run()
