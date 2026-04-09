import ExcelJS from "exceljs";

/**
 * This class provides simple methods to store, read, and retrieve
 * text data without interacting with the file system.
 *
 * Ideal for temporary file creation, downloads, or in-memory data processing.
 */
class TXTFileHandler {
    private content: string;

    constructor() {
        /**
         * The current text content held in memory.
         * @type {string}
         */
        this.content = "";
    }

    /**
     * Returns the current text content.
     *
     * @returns The stored text.
     */
    read(): string {
        return this.content;
    }

    /**
     * Stores text content in memory.
     * If `append` is true, the new data will be added to the existing content.
     * If false, the existing content will be replaced.
     *
     * @param data - The text to store.
     * @param [append=true] - Whether to append to existing content.
     * @returns Resolves when the operation is complete.
     */
    async write(data: string, append: boolean = true): Promise<void> {
        this.content = append ? this.content + data : data;
    }

    /**
     * Returns the current content as a UTF-8 encoded Buffer.
     *
     * @returns The UTF-8 encoded representation of the content.
     */
    getBuffer(): ArrayBuffer {
        return new TextEncoder().encode(this.content).buffer;
    }
}

/**
 * This class provides simple methods to store, read/write, and retrieve/export
 * Excel files without interacting with the file system.
 */
class ExcelFileHandler {
    private workbook!: ExcelJS.Workbook;
    private worksheet!: ExcelJS.Worksheet;

    constructor() {
        this.initCleanFile();
    }

    /**
     * Create a new in-memory workbook and worksheet.
     * Clears any existing workbook and starts fresh.
     */
    initCleanFile() {
        this.workbook = new ExcelJS.Workbook();
        this.worksheet = this.workbook.addWorksheet("Sheet1");
    }

    /**
     * Reads worksheet data into an array of objects.
     *
     * Behavior:
     * - Uses the first worksheet row as headers.
     * - Converts header names to lowercase with underscores.
     * - Optionally splits specified columns into arrays (comma-separated values).
     * - Applies an optional filter function to include/exclude rows.
     * - Applies an optional transform function (`rowMap`) to each included row.
     *
     * @param listCols - Headers whose string values should be split into arrays.
     * @param filter - Function returning true to keep a row, false to skip it (default: keep all).
     * @param rowMap - Optional function to transform each included row before adding to results.
     * @returns Array of parsed row objects.
     */
    async read(
        listCols: string[] = [],
        filter: Function = () => true,
        rowMap: Function | null = null
    ): Promise<Object[]> {
        const headerRow = this.worksheet.getRow(1)
        const headers: string[] = [];
        const data: any[] = [];

        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber - 1] = String(cell.value ?? "");
        });

        this.worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header row

            const rowData: Record<string, any> = {};
            headers.forEach((header: string, index: number) => {
                const cellValue = row.getCell(index + 1).value;
                const key = header.toLowerCase().replace(/\s+/g, "_");

                if (typeof cellValue === "string" && listCols.includes(header)) {
                    rowData[key] = cellValue
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                } else {
                    rowData[key] = cellValue;
                }
            });

            if (filter(rowData)) {
                data.push(rowMap ? rowMap(rowData) : rowData);
            }
        });

        return data;
    }

    /**
     * Add or overwrite worksheet rows from an array of objects.
     * - If append=false, starts with a clean file and new headers.
     * - If append=true and file is empty, headers are added automatically.
     *
     * @param data - Row data as objects.
     * @param append - Whether to append to existing rows (default: true).
     */
    async write(data: Record<string, any>[], append: boolean = true) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Data must be a non-empty array.");
        }

        const headers = Object.keys(data[0]);
        if (headers.length === 0) {
            throw new Error("Data objects must have at least one key.");
        }

        if (!append) {
            this.initCleanFile();
            this.worksheet.addRow(headers);
        } else if (this.worksheet.rowCount === 0) {
            this.worksheet.addRow(headers);
        }

        data.forEach((item) => {
            this.worksheet.addRow(headers.map((key) => item[key]));
        });
    }

    /**
     * Load an existing Excel file into memory from a buffer.
     *
     * @param buffer - Excel file contents.
     * @returns This handler instance.
     */
    async loadBuffer(buffer: ArrayBuffer): Promise<this> {
        await this.workbook.xlsx.load(buffer);
        this.worksheet = this.workbook.worksheets[0] || this.worksheet;
        return this;
    }

    /**
     * Export the workbook as a buffer for sending or saving.
     *
     * @returns Excel file buffer.
     */
    async getBuffer(): Promise<ArrayBuffer> {
        return await this.workbook.xlsx.writeBuffer();
    }
}

export { TXTFileHandler, ExcelFileHandler };
