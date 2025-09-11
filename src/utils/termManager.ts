// Term Manager - Determines current term based on date
export interface TermInfo {
  term: 1 | 2 | 3;
  label: string;
  startDate: Date;
  endDate: Date;
}

export class TermManager {
  private static TERMS_2024: TermInfo[] = [
    {
      term: 1,
      label: "Term 1",
      startDate: new Date(2024, 0, 8), // January 8
      endDate: new Date(2024, 3, 5),   // April 5
    },
    {
      term: 2,
      label: "Term 2",
      startDate: new Date(2024, 4, 6), // May 6
      endDate: new Date(2024, 7, 23),  // August 23
    },
    {
      term: 3,
      label: "Term 3",
      startDate: new Date(2024, 8, 9), // September 9
      endDate: new Date(2024, 10, 8),  // November 8
    },
  ];

  private static TERMS_2025: TermInfo[] = [
    {
      term: 1,
      label: "Term 1",
      startDate: new Date(2025, 0, 6), // January 6
      endDate: new Date(2025, 3, 4),   // April 4
    },
    {
      term: 2,
      label: "Term 2",
      startDate: new Date(2025, 4, 5), // May 5
      endDate: new Date(2025, 7, 22),  // August 22
    },
    {
      term: 3,
      label: "Term 3",
      startDate: new Date(2025, 8, 8), // September 8
      endDate: new Date(2025, 10, 7),  // November 7
    },
  ];

  static getCurrentTerm(date: Date = new Date()): 1 | 2 | 3 {
    const year = date.getFullYear();
    const terms = year === 2024 ? this.TERMS_2024 : this.TERMS_2025;
    
    for (const termInfo of terms) {
      if (date >= termInfo.startDate && date <= termInfo.endDate) {
        return termInfo.term;
      }
    }
    
    // If not in any term, determine based on proximity
    if (date < terms[0].startDate) {
      // Before Term 1 starts - probably previous year's Term 3 or preparing for Term 1
      return 1;
    } else if (date > terms[2].endDate) {
      // After Term 3 ends - preparing for next year's Term 1
      return 1;
    }
    
    // Between terms - return the upcoming term
    for (let i = 0; i < terms.length - 1; i++) {
      if (date > terms[i].endDate && date < terms[i + 1].startDate) {
        return terms[i + 1].term;
      }
    }
    
    return 1; // Default fallback
  }

  static getTermInfo(term: 1 | 2 | 3, year: number = new Date().getFullYear()): TermInfo | null {
    const terms = year === 2024 ? this.TERMS_2024 : this.TERMS_2025;
    return terms.find(t => t.term === term) || null;
  }

  static getAllTerms(year: number = new Date().getFullYear()): TermInfo[] {
    return year === 2024 ? this.TERMS_2024 : this.TERMS_2025;
  }

  static isTermActive(term: 1 | 2 | 3, date: Date = new Date()): boolean {
    return this.getCurrentTerm(date) === term;
  }

  static getTermProgress(term: 1 | 2 | 3, year: number = new Date().getFullYear(), date: Date = new Date()): number {
    const termInfo = this.getTermInfo(term, year);
    if (!termInfo) return 0;

    const totalDays = termInfo.endDate.getTime() - termInfo.startDate.getTime();
    const elapsedDays = Math.max(0, date.getTime() - termInfo.startDate.getTime());
    
    return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  }
}