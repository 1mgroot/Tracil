#!/usr/bin/env python3
"""Offline partial ARS checks using the production parser and existing evaluator."""
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
import dataset_tool as dataset
from run_define import grade

ROOT = Path(__file__).resolve().parents[2]
# IDs select existing parser entries; no expected values or reference data enter projection.
CASES = {
    'DET-JSON-010': ('ars_lb', 'An_89', (), ('dataset','variable')),
    'DET-JSON-016': ('ars_vs', 'An_105', (), ('dataset','variable')),
    'DET-JSON-018': ('ars_vs', 'An_105', ('analysis',), ('dataset','variable')),
    'DET-JSON-020': ('ars_vs', 'An_105', ('analysis',), ('name','dataset','variable')),
    'DET-JSON-021': ('ars_ae', 'An_31', (), ('dataset','variable')),
}
FILES = {'ars_lb':'ars-lb-t01-ars.json','ars_vs':'ars-vs-t01-ars.json','ars_ae':'fda-ae-t06-ars.json'}


def project(case_id, parsed):
    source, analysis, prefix, fields = CASES[case_id]
    value = parsed.get(source, {}).get('methods', {}).get(analysis, {})
    checks = []
    for field in fields:
        check = {'source_id':source, 'analysis_id':analysis, 'field':field,
                 'reference_path':list(prefix+(field,)), 'present':field in value}
        if field in value:
            check['actual'] = value[field]
        else:
            check['reason'] = 'Analysis or field absent from production parser output.'
        checks.append(check)
    return checks


def run(bundle, output):
    attempts = []
    def no_network(*args, **kwargs):
        attempts.append('blocked')
        raise RuntimeError('ARS evaluation forbids network')
    with ExitStack() as stack:
        for name in ('connect','connect_ex'):
            stack.enter_context(patch.object(socket.socket,name,no_network))
        stack.enter_context(patch.object(socket,'create_connection',no_network))
        stack.enter_context(patch.dict(os.environ,{'LANGSMITH_TRACING':'false','LANGCHAIN_TRACING_V2':'false'}))
        dataset.validate(bundle)
        sys.path.insert(0,str(ROOT/'backend'))
        from services.tlf_index import parse_ars
        manifest = dataset.read_json(bundle/'manifest.json')
        hashes = {s['source_id']:s['sha256'] for s in manifest['sources']}
        parsed, sources = {}, {}
        for sid, name in FILES.items():
            path = bundle.parent/name
            dataset.require(dataset.digest(path)==hashes[sid],f'{sid}: source hash mismatch')
            sources[sid] = dataset.digest(path)
            parsed[sid] = parse_ars(path)
        # Complete target projections before loading references into evaluator.
        projected = {cid:project(cid,parsed) for cid in CASES}
        refs = {r['case_id']:r['expected_output'] for r in dataset.read_lines(bundle/'references/deterministic.jsonl')}
        results = [{'case_id':cid,'status':'partial','full_case_score':None,
                    'checks':grade(checks,refs[cid]),
                    'not_assessed':'Reference joins, method, conditions, grouping roles, parent hierarchy and native IDs.'}
                   for cid,checks in projected.items()]
        dataset.require(not attempts,'Unexpected network attempt')
    checks = [c for r in results for c in r['checks']]
    report = {'created_at':datetime.now(timezone.utc).isoformat(),
      'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
      'parser':'backend/services/tlf_index.py:parse_ars',
      'parser_sha256':dataset.digest(ROOT/'backend/services/tlf_index.py'),
      'runner_sha256':dataset.digest(Path(__file__)),
      'reference_sha256':dataset.digest(bundle/'references/deterministic.jsonl'),
      'source_hashes':sources,'partial_cases':len(results),'full_case_supported':0,
      'field_checks':len(checks),'field_passed':sum(c['pass'] for c in checks),
      'network_attempts':len(attempts),'model_calls':0,'results':results}
    output.mkdir(parents=True,exist_ok=True)
    dataset.write_json(output/'report.json',report)
    dataset.write_json(output/'parser-output.json',parsed)
    lines=['# ARS 5例部分字段检查','',
      f"{report['field_passed']}/{report['field_checks']} 字段通过；不是5条完整题目通过率。同一 An_105 的字段在不同案例中重复检查，不是独立质量样本。",'',
      '| 案例 | 字段 | 实际 | 预期 | 结果 |','|---|---|---|---|---|']
    for r in results:
        for c in r['checks']:
            lines.append(f"| {r['case_id']} | {c['field']} | {c.get('actual','<missing>')} | {c['expected']} | {'pass' if c['pass'] else 'fail'} |")
    lines += ['', '直接调用现有parse_ars，仅做输出字段投影；未另读原始JSON补答案。',
              '完整引用链、方法、条件、分组、目录范围和身份定位仍未评测。未调用模型。']
    (output/'REPORT.md').write_text('\n'.join(lines)+'\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,default=ROOT/'local-test-data/eval-v0')
    parser.add_argument('--output',type=Path,default=ROOT/'local-test-data/test-results/ars-parser')
    args = parser.parse_args()
    result = run(args.bundle.resolve(),args.output.resolve())
    print(json.dumps({k:v for k,v in result.items() if k!='results'},indent=2))
