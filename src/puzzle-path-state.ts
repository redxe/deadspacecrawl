export interface PathPuzzle {
  id: string
  title: string
  completed: boolean
  configured: boolean
  reviewable?: boolean
}

export function getPuzzlePath(puzzles: readonly PathPuzzle[]) {
  let prerequisitesComplete = true
  return puzzles.map((puzzle, index) => {
    const status = !prerequisitesComplete ? 'locked'
      : !puzzle.configured ? 'pending'
      : puzzle.completed ? 'completed' : 'available'
    prerequisitesComplete = prerequisitesComplete && puzzle.completed && puzzle.configured
    return { ...puzzle, status, prerequisite: puzzles[index - 1]?.title }
  })
}