// ─── Score / Streak Display ───

import type { FC } from 'react';

interface ScoreBarProps {
  score: number;
  streak: number;
  bestStreak: number;
  highScore: number;
}

const ScoreBar: FC<ScoreBarProps> = ({ score, streak, bestStreak, highScore }) => (
  <div className="flex items-baseline gap-2 sm:gap-3 font-mono text-[12px] sm:text-[14px] tracking-wider whitespace-nowrap">
    <span className="text-[hsl(35,18%,55%)]">
      <span className="text-[hsl(35,22%,78%)] font-bold">{score}</span>
      <span className="text-[hsl(20,8%,50%)] ml-1">pts</span>
    </span>
    <span className="text-[hsl(32,70%,52%)]">
      <span className="font-bold">{streak}</span>
      <span className="text-[hsl(20,8%,50%)] ml-1">streak</span>
    </span>
    {bestStreak > 0 && (
      <span className="text-[hsl(20,8%,50%)]">
        best <span className="text-[hsl(32,50%,45%)] font-bold">{bestStreak}</span>
      </span>
    )}
    {highScore > 0 && (
      <span className="text-[hsl(20,8%,50%)]">
        hi <span className="text-[hsl(32,50%,45%)] font-bold">{highScore}</span>
      </span>
    )}
  </div>
);

export default ScoreBar;
