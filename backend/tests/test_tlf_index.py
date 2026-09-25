"""Public synthetic metadata for the ARS-only navigation regression."""

import json
from services.tlf_index import build_tlf_index_from_uploads


def test_ars_only_display_is_navigable_with_source_reference(tmp_path):
    source = tmp_path / "example-ars.json"
    source.write_text(json.dumps({"title": "Example display", "outputs": []}))
    entities, index = build_tlf_index_from_uploads(
        tmp_path, [{"kind": "tlf_ars_json", "path": source, "saved": source.name}]
    )
    entity = entities["EXAMPLE"]
    assert entity["name"] == index["displays"][0]["id"] == "EXAMPLE"
    assert entity["label"] == "Example display"
    assert entity["variables"] == []
    assert entity["sourceFiles"][0]["fileId"] == source.name
    assert entity["metadata"]["validationStatus"] == "unknown"
