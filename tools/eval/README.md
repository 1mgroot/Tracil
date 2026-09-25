# Local evaluation tools

Run from the repository root using the backend virtual environment:

```sh
backend/venv/bin/python -m pip install -r tools/eval/requirements.txt
backend/venv/bin/python -m pip check
backend/venv/bin/python -m unittest discover -s tools/eval -p 'test_*.py'
backend/venv/bin/python tools/eval/dataset_tool.py validate
backend/venv/bin/python tools/eval/langsmith_dataset.py verify
backend/venv/bin/python tools/eval/check_langsmith_sdk.py
```

`requirements.txt` pins the two direct evaluation dependencies. `constraints.txt`
is derived from backend/requirements.txt (extras stripped for pip compatibility);
refresh it when the backend lock changes.

The default bundle is local-test-data/eval-v0, which is gitignored and must exist
locally. These checks do not call models or upload data. SDK validation evaluates
two synthetic examples only; it does not measure Tracil quality. The source PDF
may emit warnings about malformed object offsets; a successful validation still
requires all referenced evidence to match.

Use `dataset_tool.py score --predictions PATH` for deterministic predictions in
the supported format. An application adapter and semantic evaluation pipeline
are not implemented by these tools.

## Existing Define parser coverage

```sh
backend/venv/bin/python tools/eval/run_define.py
```

This offline runner calls the actual `main.parse_define_minimal` once on the
ADaM source and classifies all 20 DET-DEFINE cases. Three cases expose partial
field checks; 17 have no supported projection. It does not implement a new XML
reader, infer native attributes from normalized values, or run 20 complete
application queries. Source and code hashes accompany the report.

Reports and raw parser output default to ignored
`local-test-data/test-results/define-parser/`. A successful exit means the report
was produced, not that quality checks passed: inspect `field_passed`,
`field_checks`, `full_case_supported`, and per-case statuses. Parser execution
errors exit nonzero. Network attempts are blocked and invalidate the run.

Use the backend virtual environment; requirements.txt here adds evaluation
packages, while backend/requirements.txt supplies the application dependencies.

## Existing ARS parser fields

```sh
backend/venv/bin/python tools/eval/run_ars.py
```

Calls production `services.tlf_index.parse_ars` on the three local ARS sources.
Adds partial checks for DET-JSON-010/016/018/020/021 (11 fields). It only projects
existing analysis dataset/variable/name output, never resolves references in a
parallel parser. Repeated fields across cases are not independent samples.
Reports default to ignored `local-test-data/test-results/ars-parser/`.
Exit zero means report generation succeeded; inspect field scores separately.
These are component checks, not full-case or end-to-end lineage scores.

## LangSmith: eight partial parser cases

```sh
backend/venv/bin/python tools/eval/langsmith_partial.py
```

This runs the actual production parsers through LangSmith `evaluate()` with
`upload_results=False` and network blocked. Eight examples include 15 field
checks. References are evaluator-only; the target receives only case_id.
Default report: local-test-data/test-results/langsmith-partial-8/report.json.
Expected baseline: 12/15 fields match, 6/8 examples match all selected fields.
These are partial fields, not full original-case passes. Failing quality scores
are retained; target/evaluator execution errors make the command fail.

For a cloud experiment, configure LANGSMITH_API_KEY in backend/.env (never
commit it), plus LANGSMITH_ENDPOINT and LANGSMITH_WORKSPACE_ID if applicable:

```sh
backend/venv/bin/python tools/eval/langsmith_partial.py --upload
```

Cloud mode sends the selected reference fields, actual selected output fields,
case IDs, scores, code/source hashes, and Git commit to the configured LangSmith
workspace. Original documents and complete parser output are not uploaded.
The snapshot dataset has a stable name and is reused only if examples match;
no existing examples are overwritten. Cloud execution requires credentials and
has not been verified by the initial offline run. No OpenAI calls are needed.

## Live model lineage baseline (three cases)

```sh
backend/venv/bin/python tools/eval/langsmith_lineage.py
```

Requires both configured API keys. This command makes paid OpenAI calls and
uploads graphs, model/usage metadata, timing and edge feedback to LangSmith.
It does not upload source documents or prompts to LangSmith. Targets are
ADVS.CHG, ADSL.SAFFL (ADaM Define only) and ADAE.AESDISAB (two Defines only).
The real upload/API/workflow/builders run serially, with case-specific legacy
output roots. This harness isolation is not a production session-isolation fix.
Every run has a new local directory under local-test-data/test-results/langsmith-lineage-3.

The dataset snapshot includes source hashes, queries and required edges, and
is reused only when these match. Edge recall measures only endpoint/direction
presence; extra edges are review candidates, not automatically errors. Conditions,
provenance and clinical correctness are not scored. Current primary is gpt-4o,
fallback gpt-4o-mini; provider-returned models are recorded for each call.
