import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'quantum-relay', sequence: '03', kind: 'logic', title: 'Across the Quantum Relay',
  summary: 'Three qubits. One unknown state. Leave no trace on the sending wires.',
  objective: 'Build a measurement-free circuit that maps |x00> to |00x>, recover the AES key, and decode the transmission.',
  blocks: [{ type: 'quantum' }],
  answer: {
    accepted: ['i built all of this for you ferry! if youre still playing that must mean that youre interested hehe'],
    label: 'Decoded transmission', placeholder: 'Verify the circuit and decrypt the transmission first',
  },
  hints: [
    'Create an entangled resource on qubits 2 and 3 before coupling the unknown state on qubit 1.',
    'Replace the usual measured correction bits with quantum controls. An X correction and a Z correction address different errors.',
    'Once corrections isolate the state on qubit 3, inspect the first two qubits. Hadamard takes |+> back to |0>.',
    'Correct probabilities are not enough: the phase of a superposition must survive, and both sending wires must end in zero.',
  ],
  consoleData: { qubits: 3, input: '|x00>', output: '|00x>', measurements: false, encryption: 'AES-256-GCM' },
}
export default puzzle