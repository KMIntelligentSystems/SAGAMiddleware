import * as fs from 'fs';
import * as path from 'path';

export class CSVReader {
    private filePath: string = '';
    private startPoint: number;
    private totalRows: number = 0;
    private currentPosition: number = 0;
    
    constructor( startPoint: number = 0) {
        this.startPoint = startPoint;
        this.currentPosition = startPoint;
      
    }

    processFile(pathFromCode: string){
         this.filePath = this.extractFilePathFromPython(pathFromCode);
           this.validateFile();
    }

    private extractFilePathFromPython(pythonCode: string): string {
        const csvPattern = /\.to_csv\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*[^)]*)?/g;
        const match = csvPattern.exec(pythonCode);
        
        if (!match) {
            throw new Error('No CSV file path found in Python code. Expected df.to_csv pattern.');
        }
        
        return match[1];
    }

    private validateFile(): void {
        if (!fs.existsSync(this.filePath)) {
            throw new Error(`File not found: ${this.filePath}`);
        }
        
        if (!path.extname(this.filePath).toLowerCase().includes('csv')) {
            throw new Error(`File is not a CSV: ${this.filePath}`);
        }
    }

    countRows(): number {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        this.totalRows = lines.length;
        return this.totalRows;
    }

    getNext20Rows(): string[] {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        
        const endPosition = Math.min(this.currentPosition + 20, lines.length);
        const rows = lines.slice(this.currentPosition, endPosition);
        this.currentPosition = endPosition;
        
        return rows;
    }

    getRowCount(): number {
        if (this.totalRows === 0) {
            this.countRows();
        }
        return this.totalRows;
    }

    resetPosition(): void {
        this.currentPosition = this.startPoint;
    }

    getCurrentPosition(): number {
        return this.currentPosition;
    }

    hasMoreRows(): boolean {
        if (this.totalRows === 0) {
            this.countRows();
        }
        return this.currentPosition < this.totalRows;
    }

    getHeaderRow(): string {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }
        
        return lines[0];
    }
}