"""Project only existing parser fields. No XML parsing or reference answers here."""

# case_id -> (dataset, variable, parser field, reference-output path)
PROJECTIONS = {
    'DET-DEFINE-004': [('ADVS', 'CHG', 'name', ('name',))],
    'DET-DEFINE-005': [('ADVS', 'CHG', 'label', ('label',))],
    'DET-DEFINE-019': [
        ('ADQSADAS', 'CHG', 'label', (0, 'label')),
        ('ADVS', 'CHG', 'label', (1, 'label')),
    ],
}
UNSUPPORTED = {
    1: 'Document standard/version declarations are not returned.',
    2: 'Native dataset OID/Purpose/Class/Structure/DomainKeys are not preserved.',
    3: 'Native dataset OID/Purpose/Class/Structure/DomainKeys are not preserved.',
    6: 'Comment and ValueListRef are not returned.',
    7: 'ValueList members and native ItemOID references are not returned.',
    8: 'Value-level ItemDefs are not exposed independently.',
    9: 'CodeList references and items are not returned.',
    10: 'CodeList references and coded values are not returned.',
    11: 'Origin, Comment and CodeListOID are not returned.',
    12: 'Comment and native OID are not returned.',
    13: 'Origin, whitespace-preserving Comment and ValueListRef are not returned.',
    14: 'Analysis selection criteria are not returned.',
    15: 'Analysis result references are not returned.',
    16: 'ResultDisplay leaf links are not returned.',
    17: 'ComputationMethod references/text are not returned.',
    18: 'External dictionaries and versions are not returned.',
    20: 'Nested ValueList references are not returned.',
}
PARTIAL_REASONS = {
    'DET-DEFINE-004': 'Only Name checked. Native ItemOID, order, original Mandatory spelling and DataType are not preserved.',
    'DET-DEFINE-005': 'Only Label checked. Origin and Comment are not returned.',
    'DET-DEFINE-019': 'Only the two Labels checked. Native OIDs and Comments are not returned.',
}


def project(case_id, parsed):
    """Accept actual parser output only; missing values stay missing, never inferred."""
    checks = []
    for dataset, variable, field, reference_path in PROJECTIONS.get(case_id, []):
        variables = parsed.get(dataset, {}).get('variables', [])
        matches = [v for v in variables if v.get('name') == variable]
        present = len(matches) == 1 and field in matches[0]
        check = {'dataset': dataset, 'variable': variable, 'field': field,
                 'reference_path': list(reference_path), 'present': present}
        if present:
            check['actual'] = matches[0][field]
        else:
            check['reason'] = 'Variable missing/ambiguous or field absent in parser output.'
        checks.append(check)
    return checks
