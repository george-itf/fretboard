// ─── Identify/Name Choice Buttons ───

import type { FC } from 'react';
import { cn } from '@/lib/utils.ts';
import { displayNote } from '@/engine/music.ts';

interface ChoiceButtonsProps {
  choices: string[];
  correctAnswer: string;
  answered: boolean;
  lastResult: { correct: boolean; picked: string } | null;
  roundKey: number;
  onAnswer: (note: string) => void;
}

const ChoiceButtons: FC<ChoiceButtonsProps> = ({
  choices, correctAnswer, answered, lastResult, roundKey, onAnswer,
}) => (
  <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-lg mx-auto animate-fade-in">
    {choices.map(note => {
      const isCorrect = note === correctAnswer;
      const wasPicked = answered && lastResult?.picked === note;

      return (
        <button
          key={`${roundKey}-${note}`}
          className={cn(
            "min-w-[52px] px-4 py-3 sm:px-5 sm:py-3.5 rounded-lg font-mono font-bold text-base sm:text-lg",
            "transition-all duration-200 cursor-pointer border-none outline-none no-select",
            answered && isCorrect && "choice-correct",
            answered && wasPicked && !lastResult?.correct && "choice-wrong",
            answered && !isCorrect && !wasPicked && "opacity-30",
            !answered && "choice-idle hover:choice-hover active:choice-active",
          )}
          style={
            answered && isCorrect ? {
              background: 'radial-gradient(circle at 38% 32%, hsl(42,100%,72%), hsl(34,92%,56%) 55%, hsl(28,85%,45%))',
              color: 'hsl(20,40%,8%)',
              boxShadow: '0 0 16px hsla(32,90%,54%,0.5)',
            } : answered && wasPicked && !lastResult?.correct ? {
              background: 'radial-gradient(circle at 40% 35%, hsl(0,72%,60%), hsl(0,65%,42%))',
              color: 'hsla(0,0%,100%,0.95)',
            } : answered ? {
              background: 'hsla(25,20%,15%,0.4)',
              color: 'hsl(25,12%,35%)',
            } : {
              background: 'hsla(25,20%,15%,0.8)',
              border: '1px solid hsla(25,15%,35%,0.5)',
              color: 'hsl(38,30%,82%)',
            }
          }
          onClick={() => !answered && onAnswer(note)}
          disabled={answered}
        >
          {displayNote(note)}
        </button>
      );
    })}
  </div>
);

export default ChoiceButtons;
