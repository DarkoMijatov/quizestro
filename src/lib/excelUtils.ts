import * as XLSX from 'xlsx';

interface ExportRow {
  teamName: string;
  teamAlias: string | null;
  scores: Record<string, number>; // categoryName -> effective points (with joker/bonus)
  helpUsages?: Record<string, string[]>; // categoryName -> ['Joker', 'Bonus', etc.]
  total: number;
  rank: number;
}

interface ExportData {
  quizName: string;
  quizDate: string;
  categories: string[];
  rows: ExportRow[];
}

export function exportQuizToExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();

  // Build header row
  const headers = ['#', 'Tim', 'Alijas', ...data.categories, 'Ukupno'];

  const wsData: (string | number)[][] = [];
  // Quiz info
  wsData.push(['Kviz:', data.quizName]);
  wsData.push(['Datum:', data.quizDate]);
  wsData.push([]);
  wsData.push(headers);

  for (const row of data.rows) {
    const scoreRow: (string | number)[] = [
      row.rank,
      row.teamName,
      row.teamAlias || '',
    ];
    for (const cat of data.categories) {
      scoreRow.push(row.scores[cat] ?? 0);
    }
    scoreRow.push(row.total);
    wsData.push(scoreRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 4 },
    { wch: 25 },
    { wch: 20 },
    ...data.categories.map(() => ({ wch: 15 })),
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rezultati');
  XLSX.writeFile(wb, `${data.quizName.replace(/[^a-zA-Z0-9\u0400-\u04FF\u0100-\u024F ]/g, '_')}.xlsx`);
}

export function generateImportTemplate() {
  const wb = XLSX.utils.book_new();
  const wsData: (string | number)[][] = [];
  wsData.push(['Kviz:', 'Naziv kviza']);
  wsData.push(['Datum:', '2026-01-01']);
  wsData.push([]);
  wsData.push(['#', 'Tim', 'Alijas', 'Kategorija 1', 'Kategorija 2', 'Kategorija 3', 'Ukupno']);
  wsData.push([1, 'Naziv tima 1', 'Alijas 1', 10, 8, 12, 30]);
  wsData.push([2, 'Naziv tima 2', '', 7, 9, 6, 22]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 4 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'quiz_import_template.xlsx');
}

export interface ImportedRow {
  teamName: string;
  teamAlias: string;
  scores: Record<string, number>;
  helpUsages: Record<string, string[]>;
}

export interface ImportResult {
  categories: string[];
  rows: ImportedRow[];
}

export function parseQuizExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Find header row (the one starting with '#')
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i]?.[0]).trim() === '#') {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          reject(new Error('Could not find header row'));
          return;
        }

        const headers = rows[headerIdx].map(String);
        // Categories are between 'Alijas' and 'Ukupno'
        const aliasIdx = headers.findIndex(h => h.toLowerCase().includes('alijas') || h.toLowerCase().includes('alias'));
        const totalIdx = headers.findIndex(h => h.toLowerCase().includes('ukupno') || h.toLowerCase().includes('total'));
        
        if (aliasIdx === -1 || totalIdx === -1) {
          reject(new Error('Invalid format: missing Alijas or Ukupno columns'));
          return;
        }

        const categories = headers.slice(aliasIdx + 1, totalIdx);

        const importedRows: ImportedRow[] = [];
        // Data starts right after header row, one row per team
        let i = headerIdx + 1;
        while (i < rows.length) {
          const scoreRow = rows[i];
          if (!scoreRow || scoreRow.length === 0 || String(scoreRow[0]).trim() === '') {
            i++;
            continue;
          }

          const rank = scoreRow[0];
          if (typeof rank !== 'number' && isNaN(Number(rank))) {
            i++;
            continue;
          }

          const teamName = String(scoreRow[1] || '').trim();
          const teamAlias = String(scoreRow[2] || '').trim();

          const rowScores: Record<string, number> = {};
          for (let c = 0; c < categories.length; c++) {
            rowScores[categories[c]] = Number(scoreRow[aliasIdx + 1 + c]) || 0;
          }

          i++;

          if (teamName) {
            importedRows.push({ teamName, teamAlias, scores: rowScores, helpUsages: {} });
          }
        }

        resolve({ categories, rows: importedRows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ========== Question Bank Import ==========

export interface ImportedQuestion {
  type: 'text' | 'multiple_choice' | 'matching';
  questionText: string;
  categoryName: string;
  answers: { text: string; isCorrect: boolean }[];
  pairs: { left: string; right: string }[];
}

export interface ImportRowError {
  sheet: string;
  row: number;
  message: string;
}

export interface QuestionImportResult {
  questions: ImportedQuestion[];
  newCategories: string[];
  errors: ImportRowError[];
}

export function generateQuestionImportTemplate(lang: 'sr' | 'en' = 'sr') {
  const wb = XLSX.utils.book_new();

  if (lang === 'en') {
    // Sheet 1: Text questions
    const textData: (string | number)[][] = [
      ['Category', 'Question text', 'Correct answer'],
      ['History', 'Who was the first president of the USA?', 'George Washington'],
      ['Geography', 'What is the capital of France?', 'Paris'],
    ];
    const wsText = XLSX.utils.aoa_to_sheet(textData);
    wsText['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsText, 'Text');

    // Sheet 2: Multiple choice
    const mcData: (string | number)[][] = [
      ['Category', 'Question text', 'Answer 1', 'Correct (1/0)', 'Answer 2', 'Correct (1/0)', 'Answer 3', 'Correct (1/0)', 'Answer 4', 'Correct (1/0)'],
      ['Science', 'Which planet is closest to the Sun?', 'Mercury', 1, 'Venus', 0, 'Earth', 0, 'Mars', 0],
      ['Sports', 'How many players are on a football team?', '9', 0, '10', 0, '11', 1, '12', 0],
    ];
    const wsMC = XLSX.utils.aoa_to_sheet(mcData);
    wsMC['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsMC, 'Multiple choice');

    // Sheet 3: Matching
    const matchData: (string | number)[][] = [
      ['Category', 'Question text', 'Left 1', 'Right 1', 'Left 2', 'Right 2', 'Left 3', 'Right 3', 'Left 4', 'Right 4'],
      ['Geography', 'Match the country with its capital', 'Serbia', 'Belgrade', 'Croatia', 'Zagreb', 'Slovenia', 'Ljubljana', '', ''],
      ['History', 'Match the battle with the year', 'Battle of Kosovo', '1389', 'Battle of Mohács', '1526', '', '', '', ''],
    ];
    const wsMatch = XLSX.utils.aoa_to_sheet(matchData);
    wsMatch['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsMatch, 'Matching');
  } else {
    // Sheet 1: Text questions
    const textData: (string | number)[][] = [
      ['Kategorija', 'Tekst pitanja', 'Tačan odgovor'],
      ['Istorija', 'Ko je bio prvi predsednik SAD?', 'Džordž Vašington'],
      ['Geografija', 'Koji je glavni grad Francuske?', 'Pariz'],
    ];
    const wsText = XLSX.utils.aoa_to_sheet(textData);
    wsText['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsText, 'Tekstualna');

    // Sheet 2: Multiple choice
    const mcData: (string | number)[][] = [
      ['Kategorija', 'Tekst pitanja', 'Odgovor 1', 'Tačan (1/0)', 'Odgovor 2', 'Tačan (1/0)', 'Odgovor 3', 'Tačan (1/0)', 'Odgovor 4', 'Tačan (1/0)'],
      ['Nauka', 'Koja planeta je najbliža Suncu?', 'Merkur', 1, 'Venera', 0, 'Zemlja', 0, 'Mars', 0],
      ['Sport', 'Koliko igrača ima fudbalski tim?', '9', 0, '10', 0, '11', 1, '12', 0],
    ];
    const wsMC = XLSX.utils.aoa_to_sheet(mcData);
    wsMC['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsMC, 'Ponudjeni odgovori');

    // Sheet 3: Matching
    const matchData: (string | number)[][] = [
      ['Kategorija', 'Tekst pitanja', 'Levo 1', 'Desno 1', 'Levo 2', 'Desno 2', 'Levo 3', 'Desno 3', 'Levo 4', 'Desno 4'],
      ['Geografija', 'Poveži državu sa glavnim gradom', 'Srbija', 'Beograd', 'Hrvatska', 'Zagreb', 'Slovenija', 'Ljubljana', '', ''],
      ['Istorija', 'Poveži bitku sa godinom', 'Kosovska bitka', '1389', 'Mohačka bitka', '1526', '', '', '', ''],
    ];
    const wsMatch = XLSX.utils.aoa_to_sheet(matchData);
    wsMatch['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsMatch, 'Povezivanje');
  }

  XLSX.writeFile(wb, 'question_import_template.xlsx');
}

export function parseQuestionExcel(file: File, existingCategories: string[]): Promise<QuestionImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const questions: ImportedQuestion[] = [];
        const allCategoryNames = new Set<string>();
        const errors: ImportRowError[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (rows.length < 2) continue;

          // Detect type based on headers
          const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
          
          let type: 'text' | 'multiple_choice' | 'matching' = 'text';
          if (headers.some(h => h.includes('levo') || h.includes('left'))) {
            type = 'matching';
          } else {
            const correctColumns = headers.filter(h => h.includes('tačan') || h.includes('correct') || h.includes('tacan'));
            if (correctColumns.length >= 2) {
              type = 'multiple_choice';
            }
          }

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 1; // Excel row number (1-indexed + header)
            
            // Skip completely empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue;

            const categoryName = String(row[0] || '').trim();
            const questionText = String(row[1] || '').trim();

            // Validate required fields
            if (!categoryName && !questionText) {
              errors.push({ sheet: sheetName, row: rowNum, message: 'Missing category and question text' });
              continue;
            }
            if (!categoryName) {
              errors.push({ sheet: sheetName, row: rowNum, message: 'Missing category' });
              continue;
            }
            if (!questionText) {
              errors.push({ sheet: sheetName, row: rowNum, message: 'Missing question text' });
              continue;
            }

            allCategoryNames.add(categoryName);

            if (type === 'text') {
              const answer = String(row[2] || '').trim();
              if (!answer) {
                errors.push({ sheet: sheetName, row: rowNum, message: 'Missing correct answer' });
                continue;
              }
              questions.push({
                type: 'text',
                questionText,
                categoryName,
                answers: [{ text: answer, isCorrect: true }],
                pairs: [],
              });
            } else if (type === 'multiple_choice') {
              const answers: { text: string; isCorrect: boolean }[] = [];
              for (let c = 2; c < row.length - 1; c += 2) {
                const ansText = String(row[c] || '').trim();
                const isCorrect = Number(row[c + 1]) === 1;
                if (ansText) answers.push({ text: ansText, isCorrect });
              }
              if (answers.length < 2) {
                errors.push({ sheet: sheetName, row: rowNum, message: 'Multiple choice needs at least 2 answers' });
                continue;
              }
              if (!answers.some(a => a.isCorrect)) {
                errors.push({ sheet: sheetName, row: rowNum, message: 'No correct answer marked (1)' });
                continue;
              }
              questions.push({
                type: 'multiple_choice',
                questionText,
                categoryName,
                answers,
                pairs: [],
              });
            } else if (type === 'matching') {
              const pairs: { left: string; right: string }[] = [];
              for (let c = 2; c < row.length - 1; c += 2) {
                const left = String(row[c] || '').trim();
                const right = String(row[c + 1] || '').trim();
                if (left && right) pairs.push({ left, right });
              }
              if (pairs.length < 2) {
                errors.push({ sheet: sheetName, row: rowNum, message: 'Matching needs at least 2 pairs' });
                continue;
              }
              questions.push({
                type: 'matching',
                questionText,
                categoryName,
                answers: [],
                pairs,
              });
            }
          }
        }

        const existingLower = new Set(existingCategories.map(c => c.toLowerCase()));
        const newCategories = [...allCategoryNames].filter(c => !existingLower.has(c.toLowerCase()));

        resolve({ questions, newCategories, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
