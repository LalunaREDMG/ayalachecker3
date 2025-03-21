"use client";

import { useState, useCallback } from "react";

interface FileStatus {
  file: File;
  content: string;
  type: "HEADER" | "DETAILS" | "INVALID";
  validation: {
    isValid: boolean;
    message: string;
  };
}

interface FileCounts {
  header: number;
  details: number;
}

interface ComparisonResult {
  netComputation: string;
  transCount: number;
  rawGross: number;
  dlySale: number;
  servCharge: number;
  vat: number;
  nonVat: number;
  totDisc: number;
  totRef: number;
  dlySaleVatServCharge: number;
}

interface DateGroupedResult {
  date: string;
  results: ComparisonResult;
}

interface HeaderData {
  tranDate: string;
  dlySale: number;
  totDisc: number;
  totRef: number;
  totCan: number;
  vat: number;
  servCharge: number;
  notaxSale: number;
  rawGross: number;
  tranCnt: number;
}

interface DetailsData {
  sales: number[];
  tranCounts: number[];
}

export default function FileUpload() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [counts, setCounts] = useState<FileCounts>({ header: 0, details: 0 });
  const [groupedResults, setGroupedResults] = useState<DateGroupedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const determineFileType = (
    fileName: string
  ): "HEADER" | "DETAILS" | "INVALID" => {
    if (!fileName.endsWith(".txt")) return "INVALID";

    if (fileName.endsWith("H.txt")) {
      return "DETAILS";
    } else if (fileName.endsWith(".txt")) {
      // Check if the last character before .txt is not a letter
      const charBeforeTxt = fileName.slice(-5, -4);
      if (!/[a-zA-Z]/.test(charBeforeTxt)) {
        return "HEADER";
      }
    }
    return "INVALID";
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      setGroupedResults([]); // Reset grouped results on new file upload

      // Process each file
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileType = determineFileType(file.name);

          if (fileType === "INVALID") {
            return {
              file,
              content: "",
              type: fileType,
              validation: {
                isValid: false,
                message: "Invalid file name format",
              },
            };
          }

          // Read file content
          const content = await file.text();
          const validation = validateContent(content);

          return {
            file,
            content,
            type: fileType,
            validation,
          };
        })
      );

      setFiles((prevFiles) => {
        const newFiles = [...prevFiles, ...processedFiles];

        // Update counts
        const newCounts = newFiles.reduce(
          (acc, file) => {
            if (file.type === "HEADER") acc.header++;
            if (file.type === "DETAILS") acc.details++;
            return acc;
          },
          { header: 0, details: 0 }
        );

        setCounts(newCounts);
        return newFiles;
      });
    },
    []
  );

  const validateContent = (
    text: string
  ): { isValid: boolean; message: string } => {
    if (text.length === 0) {
      return {
        isValid: false,
        message: "File is empty",
      };
    }

    if (text.length > 10000) {
      return {
        isValid: false,
        message: "File is too large (max 10,000 characters)",
      };
    }

    return {
      isValid: true,
      message: "File is valid",
    };
  };

  const extractDateFromFileName = (fileName: string): string | null => {
    // Expecting format: 6000000002046MMDD in the filename
    const match = fileName.match(/600000000(\d{4})(\d{2})(\d{2})/);
    if (!match) return null;

    const year = match[1];
    const month = match[2];
    const day = match[3];

    // Return in MM/DD/YYYY format to match the file content format
    return `${month}/${day}/${year}`;
  };

  const parseHeaderFile = (content: string): HeaderData | null => {
    try {
      const lines = content.split("\n");
      if (lines.length < 2) return null;

      const dataLine = lines[1].split(",");
      return {
        tranDate: dataLine[0], // Format: MM/DD/YYYY
        dlySale: parseFloat(dataLine[3]),
        totDisc: parseFloat(dataLine[4]),
        totRef: parseFloat(dataLine[5]),
        totCan: parseFloat(dataLine[6]),
        vat: parseFloat(dataLine[7]),
        servCharge: parseFloat(dataLine[15]),
        notaxSale: parseFloat(dataLine[16]),
        rawGross: parseFloat(dataLine[17]),
        tranCnt: parseInt(dataLine[13]),
      };
    } catch (error) {
      console.error("Error parsing header file:", error);
      return null;
    }
  };

  const parseDetailsFile = (content: string): DetailsData => {
    const lines = content.split("\n");
    const sales: number[] = [];
    const tranCounts: number[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [, hour, sale, tranCount] = line.split(",");
      sales.push(parseFloat(sale));
      tranCounts.push(parseInt(tranCount));
    }

    return { sales, tranCounts };
  };

  const processFiles = async () => {
    setIsProcessing(true);
    try {
      // Group files by date
      const dateGroups = files.reduce(
        (
          groups: {
            [key: string]: { header?: FileStatus; details?: FileStatus };
          },
          file
        ) => {
          const date = extractDateFromFileName(file.file.name);
          if (date) {
            if (!groups[date]) {
              groups[date] = {};
            }
            if (file.type === "HEADER") {
              groups[date].header = file;
            } else if (file.type === "DETAILS") {
              groups[date].details = file;
            }
          }
          return groups;
        },
        {}
      );

      // Process each date group
      const results: DateGroupedResult[] = Object.entries(dateGroups).map(
        ([date, files]) => {
          if (!files.header || !files.details) {
            throw new Error(`Missing files for date ${date}`);
          }

          const headerData = parseHeaderFile(files.header.content);
          const detailsData = parseDetailsFile(files.details.content);

          if (!headerData) {
            throw new Error(`Invalid header file for date ${date}`);
          }

          // Verify the dates match between filename and content
          if (headerData.tranDate !== date) {
            console.warn(
              `Date mismatch: filename has ${date} but content has ${headerData.tranDate}`
            );
          }

          // Calculate totals from details
          const detailsTotalSales = detailsData.sales.reduce(
            (a, b) => a + b,
            0
          );
          const detailsTotalTrans = detailsData.tranCounts.reduce(
            (a, b) => a + b,
            0
          );

          return {
            date: headerData.tranDate, // Use the date from the file content
            results: {
              netComputation:
                detailsTotalSales === headerData.dlySale ? "Tally" : "Mismatch",
              transCount: headerData.tranCnt,
              rawGross: headerData.rawGross,
              dlySale: headerData.dlySale,
              servCharge: headerData.servCharge,
              vat: headerData.vat,
              nonVat: headerData.notaxSale,
              totDisc: headerData.totDisc,
              totRef: headerData.totRef + headerData.totCan,
              dlySaleVatServCharge:
                headerData.dlySale + headerData.vat + headerData.servCharge,
            },
          };
        }
      );

      // Sort results by date
      results.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setGroupedResults(results);
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const ResultTable = ({ result }: { result: ComparisonResult }) => (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">
            Description
          </th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">
            Value
          </th>
          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-600">
            Result
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">Net Computation</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.netComputation}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Equal
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">TRANS COUNT</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.transCount}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Match
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">RAW GROSS</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.rawGross.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
              Computed
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">DLYSALE</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.dlySale.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">SERVCHARGE</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.servCharge.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">VAT</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.vat.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">NON-VAT</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.nonVat.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">TOTDISC</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.totDisc.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">TOTREF + TOTCAN</td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.totRef.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm text-gray-700">
            DLYSALE + VAT + SERVCHARGE
          </td>
          <td className="px-6 py-4 text-sm text-right text-gray-700">
            {result.dlySaleVatServCharge.toFixed(2)}
          </td>
          <td className="px-6 py-4 text-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Read-Only
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6 bg-white">
      <div className="flex justify-between mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
        <div className="text-sm text-gray-600">
          <p className="mb-1">
            Header Files:{" "}
            <span className="font-semibold text-gray-900">{counts.header}</span>
          </p>
          <p>
            Details Files:{" "}
            <span className="font-semibold text-gray-900">
              {counts.details}
            </span>
          </p>
        </div>
        <div className="text-sm text-gray-500">
          <p className="mb-1">
            Header format:{" "}
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
              number.txt
            </span>
          </p>
          <p>
            Details format:{" "}
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
              numberH.txt
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300 transition-colors duration-200"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-10 h-10 mb-4 text-blue-500"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 20 16"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
              />
            </svg>
            <p className="mb-2 text-sm text-gray-600">
              <span className="font-semibold text-blue-600">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              Accepts .txt files (number.txt or numberH.txt)
            </p>
          </div>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".txt"
            multiple
            onChange={handleFileChange}
          />
        </label>
      </div>

      {files.length > 0 && (
        <button
          onClick={processFiles}
          disabled={isProcessing}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200 font-medium shadow-sm"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </span>
          ) : (
            "Process Files"
          )}
        </button>
      )}

      {groupedResults.length > 0 && (
        <div className="space-y-6">
          {groupedResults.map((group, index) => (
            <div
              key={group.date}
              className="border rounded-lg overflow-hidden shadow-sm"
            >
              <div className="bg-gray-50 px-6 py-3 font-medium text-gray-700 border-b">
                Date: {group.date}
              </div>
              <div className="p-1">
                <ResultTable result={group.results} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
