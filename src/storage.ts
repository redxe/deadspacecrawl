import type { Puzzle, PuzzleKind } from './puzzles/types'

const ARCHIVE_KEY = 'signal-archive.solutions.v1'

export interface SavedAttempt {
  answer: string
  correct: boolean
  submittedAt: string
}

export interface PuzzleRecord {
  puzzleId: string
  sequence: string
  title: string
  kind: PuzzleKind
  attempts: SavedAttempt[]
  solved: boolean
  solvedAnswer?: string
  solvedAt?: string
}

interface ArchiveState {
  version: 1
  records: Record<string, PuzzleRecord>
}

const emptyArchive = (): ArchiveState => ({ version: 1, records: {} })

function readArchive(): ArchiveState {
  try {
    const saved = localStorage.getItem(ARCHIVE_KEY)
    if (!saved) {
      return emptyArchive()
    }

    const archive = JSON.parse(saved) as Partial<ArchiveState>
    if (archive.version !== 1 || !archive.records) {
      return emptyArchive()
    }

    return archive as ArchiveState
  } catch {
    return emptyArchive()
  }
}

function writeArchive(archive: ArchiveState): void {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive))
  } catch {
    // The puzzle remains playable when storage is blocked or full.
  }
}

export function saveAttempt(
  puzzle: Puzzle,
  answer: string,
  correct: boolean,
): PuzzleRecord {
  const archive = readArchive()
  const previous = archive.records[puzzle.id]
  const submittedAt = new Date().toISOString()
  const attempt: SavedAttempt = { answer, correct, submittedAt }
  const record: PuzzleRecord = {
    puzzleId: puzzle.id,
    sequence: puzzle.sequence,
    title: puzzle.title,
    kind: puzzle.kind,
    attempts: [...(previous?.attempts ?? []), attempt].slice(-40),
    solved: previous?.solved === true || correct,
    solvedAnswer: correct ? answer : previous?.solvedAnswer,
    solvedAt: correct ? submittedAt : previous?.solvedAt,
  }

  archive.records[puzzle.id] = record
  writeArchive(archive)
  return record
}

export function getPuzzleRecord(puzzleId: string): PuzzleRecord | undefined {
  return readArchive().records[puzzleId]
}

export function getPuzzleRecords(): PuzzleRecord[] {
  return Object.values(readArchive().records).sort((first, second) => {
    const firstDate = first.solvedAt ?? first.attempts.at(-1)?.submittedAt ?? ''
    const secondDate = second.solvedAt ?? second.attempts.at(-1)?.submittedAt ?? ''
    return secondDate.localeCompare(firstDate)
  })
}

export function clearPuzzleRecords(): void {
  try {
    localStorage.removeItem(ARCHIVE_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}