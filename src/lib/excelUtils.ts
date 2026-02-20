import * as XLSX from 'xlsx';

interface ExportRow {
  teamName: string;
  teamAlias: string | null;
  scores: Record<string, number>; // categoryName -> points
  helpUsages: Record<string, string[]>; // categoryName -> ['Joker', 'Double Chance']
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
  const helpHeaders = ['', '', '', ...data.categories.map(() => 'Pomoći'), ''];

  const wsData: (string | number)[][] = [];
  // Quiz info
  wsData.push(['Kviz:', data.quizName]);
  wsData.push(['Datum:', data.quizDate]);
  wsData.push([]);
  wsData.push(headers);
  wsData.push(helpHeaders);

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

    // Help row
    const helpRow: (string | number)[] = ['', '', ''];
    for (const cat of data.categories) {
      helpRow.push((row.helpUsages[cat] || []).join(', '));
    }
    helpRow.push('');
    wsData.push(helpRow);
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

export interface ImportedRow {
  teamName: string;
  teamAlias: string;
  scores: Record<string, number>; // categoryName -> points
  helpUsages: Record<string, string[]>; // categoryName -> help names
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
        const helpRowIdx = headerIdx + 1; // help headers row

        const importedRows: ImportedRow[] = [];
        // Data starts after help headers row, every 2 rows = 1 team (score row + help row)
        let i = helpRowIdx + 1;
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

          // Next row should be help row
          const helpRow = rows[i + 1];
          const rowHelps: Record<string, string[]> = {};
          if (helpRow && String(helpRow[0] || '').trim() === '') {
            for (let c = 0; c < categories.length; c++) {
              const helpStr = String(helpRow[aliasIdx + 1 + c] || '').trim();
              rowHelps[categories[c]] = helpStr ? helpStr.split(',').map(s => s.trim()).filter(Boolean) : [];
            }
            i += 2;
          } else {
            i += 1;
          }

          if (teamName) {
            importedRows.push({ teamName, teamAlias, scores: rowScores, helpUsages: rowHelps });
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
