// Term Manager - Determines current term based on date
// Uses Kenyan school calendar defaults, dynamically generated per year
export interface TermInfo {
  term: 1 | 2 | 3;
  label: string;
  startDate: Date;
  endDate: Date;
}

export class TermManager {
  /** Generate default Kenyan school calendar for any year */
  private static getTermsForYear(year: number): TermInfo[] {
    return [
      {
        term: 1,
        label: "Term 1",
        startDate: new Date(year, 0, 6),   // ~Jan 6
        endDate: new Date(year, 3, 4),     // ~Apr 4
      },
      {
        term: 2,
        label: "Term 2",
        startDate: new Date(year, 4, 5),   // ~May 5
        endDate: new Date(year, 7, 22),    // ~Aug 22
      },
      {
        term: 3,
        label: "Term 3",
        startDate: new Date(year, 8, 8),   // ~Sep 8
        endDate: new Date(year, 10, 7),    // ~Nov 7
      },
    ];
  }

  static getCurrentTerm(date: Date = new Date()): 1 | 2 | 3 {
    const year = date.getFullYear();
    const terms = this.getTermsForYear(year);

    for (const termInfo of terms) {
      if (date >= termInfo.startDate && date <= termInfo.endDate) {
        return termInfo.term;
      }
    }

    // If not in any term, determine based on proximity
    if (date < terms[0].startDate) return 1;
    if (date > terms[2].endDate) return 1;

    // Between terms - return the upcoming term
    for (let i = 0; i < terms.length - 1; i++) {
      if (date > terms[i].endDate && date < terms[i + 1].startDate) {
        return terms[i + 1].term;
      }
    }

    return 1;
  }

  static getCurrentYear(date: Date = new Date()): number {
    return date.getFullYear();
  }

  static getTermInfo(term: 1 | 2 | 3, year: number = new Date().getFullYear()): TermInfo | null {
    const terms = this.getTermsForYear(year);
    return terms.find(t => t.term === term) || null;
  }

  static getAllTerms(year: number = new Date().getFullYear()): TermInfo[] {
    return this.getTermsForYear(year);
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