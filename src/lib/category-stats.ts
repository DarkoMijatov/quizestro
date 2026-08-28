type QuizLike = {
  id: string;
  status?: string | null;
  scoring_mode?: string | null;
  categories_filled?: boolean | null;
};

type ScoreLike = {
  quiz_id: string;
  quiz_team_id: string;
  quiz_category_id: string;
  points?: number | null;
};

type PartScoreLike = {
  quiz_id: string;
  quiz_team_id: string;
  points?: number | null;
};

export function getCompleteCategoryStatsQuizIds({
  quizzes,
  scores,
  partScores,
}: {
  quizzes: QuizLike[];
  scores: ScoreLike[];
  partScores: PartScoreLike[];
}) {
  const validQuizIds = new Set<string>();

  for (const quiz of quizzes) {
    if (quiz.status !== 'finished') continue;
    if (quiz.scoring_mode !== 'per_part') {
      validQuizIds.add(quiz.id);
      continue;
    }

    const quizScores = scores.filter((score) => score.quiz_id === quiz.id);
    const quizPartScores = partScores.filter((score) => score.quiz_id === quiz.id);

    if (quizScores.length === 0 || quizPartScores.length === 0) continue;

    // Category averages are based on raw entered points only, so completeness
    // is checked against raw points as well (excluding Joker doubling and Bonus +1).
    const categoryTotalsByTeam = new Map<string, number>();
    for (const score of quizScores) {
      categoryTotalsByTeam.set(
        score.quiz_team_id,
        (categoryTotalsByTeam.get(score.quiz_team_id) || 0) + Number(score.points || 0)
      );
    }

    const partTotalsByTeam = new Map<string, number>();
    for (const partScore of quizPartScores) {
      partTotalsByTeam.set(
        partScore.quiz_team_id,
        (partTotalsByTeam.get(partScore.quiz_team_id) || 0) + Number(partScore.points || 0)
      );
    }

    const allTeamIds = new Set([
      ...Array.from(categoryTotalsByTeam.keys()),
      ...Array.from(partTotalsByTeam.keys()),
    ]);

    if (allTeamIds.size === 0) continue;

    const isConsistent = Array.from(allTeamIds).every((quizTeamId) => {
      const categoryTotal = categoryTotalsByTeam.get(quizTeamId) || 0;
      const partTotal = partTotalsByTeam.get(quizTeamId) || 0;
      return Math.abs(categoryTotal - partTotal) < 0.0001;
    });

    if (isConsistent) {
      validQuizIds.add(quiz.id);
    }
  }

  return validQuizIds;
}
