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
  bonus_points?: number | null;
};

type PartScoreLike = {
  quiz_id: string;
  quiz_team_id: string;
  points?: number | null;
};

type HelpUsageLike = {
  quiz_id: string;
  quiz_team_id: string;
  quiz_category_id: string;
  help_type_id: string;
};

type CategoryBonusLike = {
  quiz_id: string;
  quiz_team_id: string;
  quiz_category_id: string;
};

function makeCellKey(quizTeamId: string, quizCategoryId: string) {
  return `${quizTeamId}:${quizCategoryId}`;
}

export function getCompleteCategoryStatsQuizIds({
  quizzes,
  scores,
  partScores,
  helpUsages,
  categoryBonuses,
  jokerHelpTypeIds,
}: {
  quizzes: QuizLike[];
  scores: ScoreLike[];
  partScores: PartScoreLike[];
  helpUsages: HelpUsageLike[];
  categoryBonuses: CategoryBonusLike[];
  jokerHelpTypeIds: string[];
}) {
  const validQuizIds = new Set<string>();
  const jokerHelpTypeSet = new Set(jokerHelpTypeIds);
  const jokerUsageSet = new Set(
    helpUsages
      .filter((usage) => jokerHelpTypeSet.has(usage.help_type_id))
      .map((usage) => makeCellKey(usage.quiz_team_id, usage.quiz_category_id))
  );
  const categoryBonusSet = new Set(
    categoryBonuses.map((bonus) => makeCellKey(bonus.quiz_team_id, bonus.quiz_category_id))
  );

  for (const quiz of quizzes) {
    if (quiz.status !== 'finished') continue;
    if (quiz.scoring_mode !== 'per_part') {
      validQuizIds.add(quiz.id);
      continue;
    }

    const quizScores = scores.filter((score) => score.quiz_id === quiz.id);
    const quizPartScores = partScores.filter((score) => score.quiz_id === quiz.id);

    if (quizScores.length === 0 || quizPartScores.length === 0) continue;

    const categoryTotalsByTeam = new Map<string, number>();
    for (const score of quizScores) {
      let displayPoints = Number(score.points || 0) + Number(score.bonus_points || 0);
      if (jokerUsageSet.has(makeCellKey(score.quiz_team_id, score.quiz_category_id))) {
        displayPoints *= 2;
      }
      if (categoryBonusSet.has(makeCellKey(score.quiz_team_id, score.quiz_category_id))) {
        displayPoints += 1;
      }
      categoryTotalsByTeam.set(
        score.quiz_team_id,
        (categoryTotalsByTeam.get(score.quiz_team_id) || 0) + displayPoints
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
