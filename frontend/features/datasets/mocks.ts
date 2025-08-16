import type { MockFile } from '@/types/files'

export const mockFiles: MockFile[] = [
	// ADaM
	{ id: 'adam-adsl', name: 'ADSL', group: 'ADaM', metadata: { records: 100, sizeKB: 24 } },
	{ id: 'adam-adae', name: 'ADAE', group: 'ADaM', metadata: { records: 230, sizeKB: 40 } },
	{ id: 'adam-adlb', name: 'ADLB', group: 'ADaM', metadata: { records: 320, sizeKB: 58 } },
	// SDTM
	{ id: 'sdtm-dm', name: 'DM', group: 'SDTM', metadata: { records: 100, sizeKB: 20 } },
	{ id: 'sdtm-lb', name: 'LB', group: 'SDTM', metadata: { records: 540, sizeKB: 110 } },
	{ id: 'sdtm-ae', name: 'AE', group: 'SDTM', metadata: { records: 410, sizeKB: 84 } },
	{ id: 'sdtm-vs', name: 'VS', group: 'SDTM', metadata: { records: 260, sizeKB: 52 } },
	{ id: 'sdtm-mh', name: 'MH', group: 'SDTM', metadata: { records: 190, sizeKB: 36 } },
	{ id: 'sdtm-sc', name: 'SC', group: 'SDTM', metadata: { records: 210, sizeKB: 40 } },
	{ id: 'sdtm-sv', name: 'SV', group: 'SDTM', metadata: { records: 180, sizeKB: 30 } },
	// aCRF
	{ id: 'acrf-pdf', name: 'aCRF_v1.0.pdf', group: 'aCRF', metadata: { sizeKB: 1024 } },
	// TLFs (updated per doc)
	{ id: 'tlf-base-demog', name: 'base0characteristics.rtf', group: 'TLF', metadata: { sizeKB: 80 } },
	{ id: 'tlf-14-3-01', name: 'F-14-3-01.rtf', group: 'TLF', metadata: { sizeKB: 76 } },
]


