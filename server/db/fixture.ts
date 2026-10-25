import type { Draft } from '../modules/labs/model.js';
export function demoLab(): Draft {
  return {
    title: 'Measuring density',
    settings: {
      studentAI: true,
      hintPolicy: 'conceptual',
      taAI: true,
      opensAt: new Date(Date.now() - 86400000).toISOString(),
      closesAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    blocks: [
      {
        id: 'intro',
        type: 'markdown',
        title: '1. Observe the sample',
        text: '## A small measurement lab\nA sample has a **mass of 25 g** and a **volume of 10 mL**. Density describes how much mass fits into a unit of volume.\n\nCalculate the density, then explain your reasoning to a TA.',
        instructorNotes: 'Use the student’s units to diagnose whether they divided volume by mass.',
      },
      {
        id: 'formula',
        type: 'code',
        title: '2. A useful relationship',
        language: 'text',
        code: 'density = mass / volume',
      },
      {
        id: 'density',
        type: 'answer',
        title: '3. What is the density?',
        input: 'number',
        units: 'g/mL',
      },
      {
        id: 'density-check',
        type: 'checkpoint',
        title: '4. Check the calculation',
        mode: 'automatic',
        answerIds: ['density'],
        required: true,
        rule: { kind: 'numeric', expected: 2.5, tolerance: 0.05, units: 'g/mL' },
        instructorNotes:
          'The correct result is 2.5 g/mL. A result of 0.4 suggests an inverted ratio.',
      },
      {
        id: 'discussion',
        type: 'checkpoint',
        title: '5. Explain your reasoning',
        mode: 'ta',
        answerIds: ['density'],
        required: true,
        rubric:
          'Student explains mass divided by volume, retains g/mL units, and predicts that doubling mass at fixed volume doubles density.',
      },
    ],
  };
}
