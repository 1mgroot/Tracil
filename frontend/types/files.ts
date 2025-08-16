export type FileGroupKind = 'ADaM' | 'SDTM' | 'aCRF' | 'TLF'

export interface MockFileMetadata {
	readonly sizeKB?: number
	readonly records?: number
	readonly updatedAt?: string
}

export interface MockFile {
	readonly id: string
	readonly name: string
	readonly group: FileGroupKind
	readonly metadata?: MockFileMetadata
}

export interface GroupedFiles {
	readonly ADaM: MockFile[]
	readonly SDTM: MockFile[]
	readonly aCRF: MockFile[]
	readonly TLF: MockFile[]
}

export function groupFilesByKind(files: ReadonlyArray<MockFile>): GroupedFiles {
	return {
		ADaM: files.filter(f => f.group === 'ADaM'),
		SDTM: files.filter(f => f.group === 'SDTM'),
		aCRF: files.filter(f => f.group === 'aCRF'),
		TLF: files.filter(f => f.group === 'TLF'),
	}
}


