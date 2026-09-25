#!/usr/bin/env python3
"""Offline coverage/partial scoring of 20 cases against the existing Define parser."""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import importlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
from unittest.mock import patch
import dataset_tool as dataset
from define_adapter import PROJECTIONS, UNSUPPORTED, PARTIAL_REASONS, project
from langsmith_dataset import exact_json_evaluator

ROOT = Path(__file__).resolve().parents[2]


def grade(checks, reference):
    result = []
    for check in checks:
        expected = reference
        for component in check['reference_path']:
            expected = expected[component]
        scored = dict(check, expected=expected)
        scored['pass'] = check['present'] and bool(exact_json_evaluator(
            {'answer': check['actual']},
            {'answer': expected, 'grading': {'method': 'exact_json'}})['score'])
        result.append(scored)
    return result


def run(bundle, output):
    attempts = []
    def no_network(*args, **kwargs):
        attempts.append('blocked')
        raise RuntimeError('Define evaluation forbids network')

    with ExitStack() as stack:
        for name in ('connect', 'connect_ex'):
            stack.enter_context(patch.object(socket.socket, name, no_network))
        stack.enter_context(patch.object(socket, 'create_connection', no_network))
        stack.enter_context(patch.dict(os.environ, {
            'LANGSMITH_TRACING': 'false', 'LANGCHAIN_TRACING_V2': 'false'}))
        dataset.validate(bundle)
        manifest = dataset.read_json(bundle/'manifest.json')
        # This runner uses the established local bundle convention: originals in its parent.
        source = bundle.parent/'define.xml'
        declared = next(s for s in manifest['sources'] if s['source_id'] == 'define_adam')
        dataset.require(dataset.digest(source) == declared['sha256'], 'ADaM source hash mismatch')
        sys.path.insert(0, str(ROOT/'backend'))
        main = importlib.import_module('main')
        try:
            parsed = main.parse_define_minimal(source)
            parse_error = None
        except Exception as exc:
            parsed, parse_error = {}, type(exc).__name__
        inputs = [r for r in dataset.read_lines(bundle/'inputs/deterministic.jsonl')
                  if r['case_id'].startswith('DET-DEFINE-')]
        dataset.require({r['case_id'] for r in inputs} ==
                        {f'DET-DEFINE-{i:03}' for i in range(1,21)}, 'Unexpected Define case set')
        # Target projection finishes before references are loaded into the evaluator.
        projected = {r['case_id']: project(r['case_id'], parsed) for r in inputs}
        refs = {r['case_id']:r['expected_output'] for r in
                dataset.read_lines(bundle/'references/deterministic.jsonl')}
        results = []
        for row in inputs:
            cid = row['case_id']
            entry = {'case_id':cid, 'full_case_status':'unsupported', 'full_case_score':None}
            if cid in PROJECTIONS:
                entry.update(status='error' if parse_error else 'partial',
                    reason=PARTIAL_REASONS[cid], checks=grade(projected[cid], refs[cid]))
                if parse_error: entry['error_type'] = parse_error
            else:
                entry.update(status='unsupported', reason=UNSUPPORTED[int(cid[-3:])], checks=[])
            results.append(entry)
        checks = [c for r in results for c in r['checks']]
        report = {'created_at':datetime.now(timezone.utc).isoformat(),
            'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'parser':'backend/main.py:parse_define_minimal',
            'parser_file_sha256':dataset.digest(ROOT/'backend/main.py'),
            'adapter_sha256':dataset.digest(Path(__file__).with_name('define_adapter.py')),
            'runner_sha256':dataset.digest(Path(__file__)),
            'reference_sha256':dataset.digest(bundle/'references/deterministic.jsonl'),
            'source_sha256':dataset.digest(source), 'total_cases':20,
            'full_case_supported':0, 'partial_cases':sum(r['status']=='partial' for r in results),
            'unsupported_cases':sum(r['status']=='unsupported' for r in results),
            'errors':sum(r['status']=='error' for r in results),
            'field_checks':len(checks),'field_passed':sum(c['pass'] for c in checks),
            'network_attempts':len(attempts),'model_calls':0,
            'clinical_quality_claim_allowed':False,'results':results}
        dataset.require(not attempts, 'Unexpected network attempt; no report may claim offline success')
    output.mkdir(parents=True,exist_ok=True)
    dataset.write_json(output/'parser-output.json',parsed)
    dataset.write_json(output/'report.json',report)
    lines=['# Define parser 20例接入报告','',
        '当前完整支持 0/20；部分字段可测 '+str(report['partial_cases'])+' 例，其余无可评分投影。',
        f"字段检查：{report['field_passed']}/{report['field_checks']}；不是20条完整题目通过率。",'',
        '| 案例 | 状态 | 原因 |','|---|---|---|']
    for row in results:
        lines.append(f"| {row['case_id']} | {row['status']} | {row['reason']} |")
        for check in row['checks']:
            lines.append(f"| ↳ {check['dataset']}.{check['variable']}.{check['field']} | {'pass' if check['pass'] else 'fail'} | 实际 {check.get('actual','<missing>')!r}；预期 {check['expected']!r} |")
    lines += ['', '业务parser未修改。未用独立XML读取补答案；未反推原始类型或Mandatory拼写；参考答案只用于评分。',
              '不支持不计为通过；失败字段不代表整个案例已被支持。原始parser输出见 parser-output.json。']
    (output/'REPORT.md').write_text('\n'.join(lines)+'\n')
    return report


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,default=ROOT/'local-test-data/eval-v0')
    parser.add_argument('--output',type=Path,default=ROOT/'local-test-data/test-results/define-parser')
    args=parser.parse_args()
    result=run(args.bundle.resolve(),args.output.resolve())
    print(json.dumps({k:v for k,v in result.items() if k!='results'},indent=2))
    if result['errors']: sys.exit(1)
