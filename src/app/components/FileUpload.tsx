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
  date?: string;
  netComputation: string | number;
  transCount: number;
  hourlyTransCount?: number;
  transCountMatch?: boolean;
  rawGross: number;
  adjustedRawGross?: number;
  dlySale: number;
  servCharge: number;
  vat: number;
  nonVat: number;
  totDisc: number;
  totRefCan: number;
  hourlySalesTotal?: number;
  hourlyTransactions?: { hour: string; count: number }[];
  beginInv?: number;
  endInv?: number;
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
  beginInv: number;
  endInv: number;
}

interface DetailsData {
  sales: number[];
  tranCounts: number[];
  hourlyLabels: string[];
}

interface FileData {
  file: File;
  isHeader: boolean;
  number: string;
}

export default function FileUpload() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [counts, setCounts] = useState<FileCounts>({ header: 0, details: 0 });
  const [groupedResults, setGroupedResults] = useState<DateGroupedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>(
    {}
  );
  const [isDragging, setIsDragging] = useState(false);

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

  const handleFiles = async (newFiles: File[]) => {
    console.log("Processing files:", newFiles.length);

    // Filter files to only include valid .txt files with the correct naming pattern
    const validFiles = newFiles.filter((file) => {
      const fileType = determineFileType(file.name);
      if (fileType === "INVALID") {
        console.log(`Skipping invalid file: ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      // Silently return without showing an alert
      console.log("No valid files found");
      return;
    }

    const filePromises = validFiles.map(async (file) => {
      return new Promise<FileStatus>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            content: e.target?.result as string,
            type: determineFileType(file.name),
            validation: {
              isValid: true,
              message: "",
            },
          });
        };
        reader.readAsText(file);
      });
    });

    const fileContents = await Promise.all(filePromises);
    setFiles((prevFiles) => [...prevFiles, ...fileContents]);

    // Update counts
    const headerCount = fileContents.filter(
      (file) => file.type === "HEADER"
    ).length;

    const detailsCount = fileContents.filter(
      (file) => file.type === "DETAILS"
    ).length;

    setCounts({
      header: counts.header + headerCount,
      details: counts.details + detailsCount,
    });

    // No alert for skipped files - silently ignore them
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      handleFiles(newFiles);
    }
  };

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

  const extractDateFromFile = (fileData: {
    file: File;
    content: string;
    type: string;
  }) => {
    // First try to extract date from the content (more reliable for your files)
    const lines = fileData.content.split("\n");
    if (lines.length > 1) {
      // Skip header line, get first data line
      const dataLine = lines[1];
      const parts = dataLine.split(",");
      if (parts.length > 0) {
        // First column should be the date in format MM/DD/YYYY
        const dateStr = parts[0].trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          return dateStr;
        }
      }
    }

    // Fallback: Try to extract from filename
    const fileName = fileData.file.name;
    // Pattern for your specific filename format: 60000000064660101.txt
    const match = fileName.match(/6000000\d{5}(\d{2})(\d{2})/);
    if (match) {
      const month = match[1];
      const day = match[2];
      // Extract year from path or use default
      return `${month}/${day}/2025`;
    }

    // Default if no date found
    return "01/01/2025";
  };

  const parseHeaderFile = (content: string): HeaderData | null => {
    try {
      const lines = content.split("\n");
      if (lines.length < 2) return null;

      // First, find the header line to identify column positions
      const headerLine = lines[0].split(",");

      // Find the index of BEGINV and ENDINV columns
      const beginvIndex = headerLine.findIndex(
        (col) => col.trim() === "BEGINV"
      );
      const endInvIndex = headerLine.findIndex(
        (col) => col.trim() === "ENDINV"
      );
      const tranCntIndex = headerLine.findIndex(
        (col) => col.trim() === "TRANCNT"
      );

      // Get the data line
      const dataLine = lines[1].split(",");

      console.log("Header columns:", headerLine);
      console.log("Data values:", dataLine);
      console.log(
        "BEGINV index:",
        beginvIndex,
        "value:",
        dataLine[beginvIndex]
      );
      console.log(
        "ENDINV index:",
        endInvIndex,
        "value:",
        dataLine[endInvIndex]
      );

      return {
        tranDate: dataLine[0], // Format: MM/DD/YYYY
        dlySale: parseFloat(dataLine[3] || "0"),
        totDisc: parseFloat(dataLine[4] || "0"),
        totRef: parseFloat(dataLine[5] || "0"),
        totCan: parseFloat(dataLine[6] || "0"),
        vat: parseFloat(dataLine[7] || "0"),
        servCharge: parseFloat(dataLine[15] || "0"),
        notaxSale: parseFloat(dataLine[16] || "0"),
        rawGross: parseFloat(dataLine[17] || "0"),
        tranCnt: parseInt(dataLine[tranCntIndex] || "0"),
        beginInv: parseInt(dataLine[beginvIndex] || "0"),
        endInv: parseInt(dataLine[endInvIndex] || "0"),
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
    const hourlyLabels: string[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",");
      if (parts.length >= 4) {
        // Get the hour label (e.g., "12:00")
        const hourLabel = parts[1].trim();

        // Handle the case where sales might be "-" instead of a number
        const saleStr = parts[2].trim();
        const sale = saleStr === "-" ? 0 : parseFloat(saleStr);

        // Handle the transaction count
        const tranCount = parseInt(parts[3] || "0");

        sales.push(isNaN(sale) ? 0 : sale);
        tranCounts.push(isNaN(tranCount) ? 0 : tranCount);
        hourlyLabels.push(hourLabel);
      }
    }

    return { sales, tranCounts, hourlyLabels };
  };

  const logHourlySales = (detailsData: DetailsData) => {
    console.log("Hourly sales breakdown:");

    let total = 0;
    detailsData.sales.forEach((sale, index) => {
      if (sale > 0) {
        console.log(`Hour ${index}: ${sale.toFixed(2)}`);
        total += sale;
      }
    });

    console.log(`Total hourly sales: ${total.toFixed(2)}`);
    return total;
  };

  const logHourlyTransactions = (detailsData: DetailsData) => {
    console.log("Hourly transaction breakdown:");

    let total = 0;
    detailsData.tranCounts.forEach((count, index) => {
      if (count > 0) {
        console.log(
          `Hour ${detailsData.hourlyLabels[index]}: ${count} transactions`
        );
        total += count;
      }
    });

    console.log(`Total transactions: ${total}`);
    return total;
  };

  const processFiles = async () => {
    setIsProcessing(true);

    try {
      console.log("Processing files:", files);

      if (!files || files.length === 0) {
        console.error("No files to process");
        alert("Please select files to process");
        setIsProcessing(false);
        return;
      }

      // Filter for only .txt files
      const txtFiles = files.filter((fileStatus) =>
        fileStatus.file.name.toLowerCase().endsWith(".txt")
      );

      if (txtFiles.length === 0) {
        console.error("No .txt files found");
        alert("Please upload .txt files");
        setIsProcessing(false);
        return;
      }

      console.log(
        "Processing .txt files:",
        txtFiles.map((f) => f.file.name)
      );

      // Read all file contents
      const fileContents = await Promise.all(
        txtFiles.map(async (fileStatus) => {
          try {
            const content = await fileStatus.file.text();
            return {
              file: fileStatus.file,
              content,
              type: fileStatus.type,
            };
          } catch (error) {
            console.error(`Error reading file ${fileStatus.file.name}:`, error);
            return {
              file: fileStatus.file,
              content: "",
              type: fileStatus.type,
            };
          }
        })
      );

      // Group files by date
      const dateGroups: Record<string, any[]> = {};

      for (const fileData of fileContents) {
        // Extract date from filename or content
        const date = extractDateFromFile(fileData);

        if (!dateGroups[date]) {
          dateGroups[date] = [];
        }

        dateGroups[date].push(fileData);
      }

      // Process each date group
      const results = Object.entries(dateGroups).map(([date, files]) => {
        const headerFiles = files.filter((f) => f.type === "HEADER");
        const detailFiles = files.filter((f) => f.type === "DETAILS");

        // Process the files for this date
        const result = processFilesForDate(headerFiles, detailFiles);

        return {
          date,
          results: result,
        };
      });

      console.log("Processed results:", results);
      setGroupedResults(results);
    } catch (error) {
      console.error("Error processing files:", error);
      alert("Error processing files. Please check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Process files for a specific date
  const processFilesForDate = (headerFiles: any[], detailFiles: any[]) => {
    console.log(
      "Processing files for date - Header files:",
      headerFiles.length,
      "Detail files:",
      detailFiles.length
    );

    // Default values
    let netComputation = "Match";
    let transCount = 0;
    let rawGross = 0;
    let dlySale = 0;
    let servCharge = 0;
    let vat = 0;
    let nonVat = 0;
    let totDisc = 0;
    let totRef = 0;
    let totCan = 0;
    let hourlySalesTotal = 0;
    let beginInv = 0;
    let endInv = 0;
    let hourlyTransTotal = 0;

    // Add arrays to store hourly breakdowns
    const hourlyTransactions: { hour: string; count: number }[] = [];

    // Process header files
    headerFiles.forEach((file) => {
      const headerData = parseHeaderFile(file.content);
      console.log("Header data parsed:", headerData);

      if (headerData) {
        // Sum values from all header files
        rawGross += headerData.rawGross || 0;
        dlySale += headerData.dlySale || 0;
        servCharge += headerData.servCharge || 0;
        vat += headerData.vat || 0;
        nonVat += headerData.notaxSale || 0;
        totDisc += headerData.totDisc || 0;
        totRef += headerData.totRef || 0;
        totCan += headerData.totCan || 0;
        transCount += headerData.tranCnt || 0;

        // Get the inventory values for transaction calculation
        beginInv = headerData.beginInv || 0;
        endInv = headerData.endInv || 0;

        console.log(
          `File ${file.file.name} - BEGINV: ${beginInv}, ENDINV: ${endInv}`
        );
      }
    });

    // Process detail files to get hourly sales and transactions
    detailFiles.forEach((file) => {
      const detailsData = parseDetailsFile(file.content);
      console.log("Details data parsed for file:", file.file.name);

      if (detailsData && detailsData.sales) {
        // Log the hourly sales for debugging
        const fileTotal = logHourlySales(detailsData);
        console.log(
          `File ${file.file.name} total sales: ${fileTotal.toFixed(2)}`
        );

        // Log the hourly transactions for debugging
        const tranTotal = logHourlyTransactions(detailsData);
        console.log(`File ${file.file.name} total transactions: ${tranTotal}`);

        // Sum the hourly transaction counts
        hourlyTransTotal += detailsData.tranCounts.reduce(
          (sum, count) => sum + count,
          0
        );

        // Store hourly transaction data
        detailsData.hourlyLabels.forEach((hour, index) => {
          if (detailsData.tranCounts[index] > 0) {
            hourlyTransactions.push({
              hour: hour,
              count: detailsData.tranCounts[index],
            });
          }
        });

        // Sum all hourly sales
        hourlySalesTotal += detailsData.sales.reduce(
          (sum, sale) => sum + sale,
          0
        );
      }
    });

    // Calculate transaction count from header file (ENDINV - BEGINV + 1)
    const headerTransCount =
      endInv && beginInv ? endInv - beginInv + 1 : transCount;
    console.log(
      `Calculated transaction count: ${headerTransCount} (ENDINV: ${endInv} - BEGINV: ${beginInv} + 1)`
    );

    // Ensure hourlyTransTotal is a number
    hourlyTransTotal = hourlyTransTotal || 0;

    // Check if transaction counts match
    const transCountMatch = hourlyTransTotal === headerTransCount;

    // Calculate the adjusted RAW GROSS using the formula
    const adjustedRawGross = rawGross - totDisc - totRef - totCan - servCharge;

    // Debug the calculation
    console.log("Calculation details:", {
      rawGross,
      totDisc,
      totRef,
      totCan,
      servCharge,
      adjustedRawGross,
      hourlySalesTotal,
    });

    // Validation logic:
    // Compare adjusted RAW GROSS with the sum of hourly sales
    const grossDifference = Math.abs(adjustedRawGross - hourlySalesTotal);

    // If difference is more than 1 cent, mark as mismatch
    if (grossDifference > 0.01) {
      netComputation = "Mismatch";
      console.log("Mismatch detected:", {
        rawGross,
        adjustedRawGross,
        hourlySalesTotal,
        difference: grossDifference,
      });
    } else {
      netComputation = "Match";
      console.log("Values match:", {
        rawGross,
        adjustedRawGross,
        hourlySalesTotal,
        difference: grossDifference,
      });
    }

    return {
      netComputation,
      transCount: headerTransCount || 0, // Ensure we don't return NaN
      hourlyTransCount: hourlyTransTotal || 0,
      transCountMatch,
      rawGross: rawGross || 0,
      adjustedRawGross: adjustedRawGross || 0,
      dlySale: dlySale || 0,
      servCharge: servCharge || 0,
      vat: vat || 0,
      nonVat: nonVat || 0,
      totDisc: totDisc || 0,
      totRefCan: totRef + totCan || 0,
      hourlySalesTotal: hourlySalesTotal || 0,
      hourlyTransactions,
      beginInv: beginInv || 0,
      endInv: endInv || 0,
    };
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const ResultTable = ({ result }: { result: ComparisonResult }) => {
    // Helper function to safely display numeric values with 2 decimal places
    const safeNumber = (value: number | undefined): string => {
      if (value === undefined || isNaN(value)) {
        return "0.00";
      }
      return value.toFixed(2);
    };

    // Calculate the values used in the net computation
    const hourlySalesTotal = result.hourlySalesTotal || 0;
    const adjustedRawGross = result.adjustedRawGross || 0;
    const grossDifference = Math.abs(adjustedRawGross - hourlySalesTotal);

    // Calculate additional metrics
    const vatPercentage =
      result.dlySale > 0
        ? ((result.vat / result.dlySale) * 100).toFixed(2)
        : "0.00";
    const discountPercentage =
      result.rawGross > 0
        ? ((result.totDisc / result.rawGross) * 100).toFixed(2)
        : "0.00";

    return (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-100 border-b border-gray-200">
              Description
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 bg-gray-100 border-b border-gray-200">
              Value
            </th>
            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-100 border-b border-gray-200">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">Net Computation</div>
              <div className="text-xs text-gray-500 mt-1">
                RAW GROSS ({safeNumber(result.rawGross)}) - TOTDISC (
                {safeNumber(result.totDisc)}) - TOTREF+TOTCAN (
                {safeNumber(result.totRefCan)}) - SERVCHARGE (
                {safeNumber(result.servCharge)}) ={" "}
                {safeNumber(result.adjustedRawGross)}
                <br />
                Sum of Hourly Sales: {safeNumber(result.hourlySalesTotal)}
                <br />
                Difference: {safeNumber(grossDifference)}
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {result.netComputation}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  result.netComputation === "Match"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {result.netComputation === "Match" ? "Match" : "Mismatch"}
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">TRANS COUNT</div>
              <div className="text-xs text-gray-500 mt-1">
                <div className="font-semibold">Header Calculation:</div>
                ENDINV ({safeNumber(result.endInv)}) - BEGINV (
                {safeNumber(result.beginInv)}) + 1 ={" "}
                {safeNumber(result.transCount)}
                <div className="font-semibold mt-2">Hourly Total:</div>
                Sum of hourly transactions:{" "}
                {safeNumber(result.hourlyTransCount)}
                {result.hourlyTransactions &&
                result.hourlyTransactions.length > 0 ? (
                  <div className="mt-2">
                    <div className="font-semibold">Hourly Breakdown:</div>
                    {result.hourlyTransactions.map((item, index) => (
                      <div key={index}>
                        {item.hour}: {item.count}{" "}
                        {item.count === 1 ? "transaction" : "transactions"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2">No hourly breakdown available</div>
                )}
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.transCount)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  result.transCountMatch
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {result.transCountMatch ? "Match" : "Mismatch"}
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              RAW GROSS
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {typeof result.rawGross === "number"
                ? result.rawGross.toFixed(2)
                : "0.00"}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                Computed
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">DLYSALE</div>
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.dlySale)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Read-Only
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              SERVCHARGE
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.servCharge)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Read-Only
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">VAT</div>
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.vat)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Read-Only
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              NON-VAT
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.nonVat)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Read-Only
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">TOTDISC</div>
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.totDisc)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Read-Only
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              TOTREF + TOTCAN
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(result.totRefCan)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Read-Only
              </span>
            </td>
          </tr>

          <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">Hourly Sales Total</div>
              <div className="text-xs text-gray-500 mt-1">
                Sum from hourly breakdown
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200">
              {safeNumber(hourlySalesTotal)}
            </td>
            <td className="px-6 py-4 text-center border-b border-gray-200">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                Computed
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    // Process all items from the dataTransfer
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      const allFiles: File[] = [];

      // Function to recursively process entries
      const processEntry = async (entry: any) => {
        if (entry.isFile) {
          // If it's a file, get the File object
          const file = await new Promise<File>((resolve) => {
            entry.file((file: File) => resolve(file));
          });
          allFiles.push(file);
        } else if (entry.isDirectory) {
          // If it's a directory, read its contents
          const reader = entry.createReader();
          const entries = await new Promise<any[]>((resolve) => {
            reader.readEntries((entries: any[]) => resolve(entries));
          });

          // Process each entry in the directory
          for (const childEntry of entries) {
            await processEntry(childEntry);
          }
        }
      };

      // Process all dropped items
      const processItems = async () => {
        for (const item of items) {
          // Only process files and directories
          if (item.kind === "file") {
            const entry = item.webkitGetAsEntry();
            if (entry) {
              await processEntry(entry);
            }
          }
        }

        // After processing all entries, handle the collected files
        if (allFiles.length > 0) {
          console.log(`Processing ${allFiles.length} files from drop`);
          handleFiles(allFiles);
        }
      };

      processItems();
    } else if (e.dataTransfer.files) {
      // Fallback for browsers that don't support DataTransferItemList
      const newFiles = Array.from(e.dataTransfer.files);
      handleFiles(newFiles);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Upload Files
        </h2>

        {/* File drop area with improved styling and folder support */}
        <div
          className={`border-2 border-dashed ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
          } rounded-lg p-8 text-center cursor-pointer transition-all hover:bg-gray-50 mb-4`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <input
            id="fileInput"
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center">
            <svg
              className={`w-12 h-12 mb-3 ${
                isDragging ? "text-blue-500" : "text-gray-400"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="mb-2 text-sm text-gray-700">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p className="text-xs text-gray-500">
              TXT files or folders containing TXT files
            </p>
          </div>
        </div>

        {/* Show only the count of uploaded files */}
        {files.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between bg-gray-50 rounded-md p-4">
              <div>
                <span className="font-medium text-gray-700">
                  Selected Files:
                </span>
                <span className="ml-2 bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm font-medium">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </span>
              </div>
              <button
                onClick={() => setFiles([])}
                className="text-red-500 hover:text-red-700 bg-transparent px-3 py-1 rounded text-sm font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Process button with improved styling */}
        <button
          onClick={processFiles}
          disabled={files.length === 0 || isProcessing}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:bg-blue-300"
        >
          {isProcessing ? "Processing..." : "Process Files"}
        </button>
      </div>

      {/* Results section with improved styling */}
      {groupedResults.length > 0 && (
        <div className="border-t border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Results</h2>
          <div className="space-y-6">
            {groupedResults.map((group, index) => {
              // Check if there are any errors for this date
              const hasNetComputationError =
                group.results.netComputation === "Mismatch";
              const hasTransCountError = !group.results.transCountMatch;
              const hasErrors = hasNetComputationError || hasTransCountError;

              return (
                <div
                  key={index}
                  className={`${
                    hasErrors ? "border-l-4 border-red-500" : ""
                  } bg-gray-50 rounded-lg overflow-hidden`}
                >
                  <div className="bg-gray-100 px-6 py-4 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-gray-800">
                        Date: {group.date || "Unknown"}
                        {group.results.transCount > 0 && (
                          <span className="ml-2 text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded-full">
                            {group.results.transCount} Transactions
                          </span>
                        )}
                      </h3>

                      {/* Error summary */}
                      {hasErrors && (
                        <div className="mt-2 text-sm">
                          {hasNetComputationError && (
                            <span className="inline-flex items-center mr-3 text-red-600">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              Net computation mismatch
                            </span>
                          )}
                          {hasTransCountError && (
                            <span className="inline-flex items-center text-red-600">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              Transaction count mismatch
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleDateExpansion(group.date)}
                      className="text-gray-500 hover:text-gray-700 bg-transparent"
                      aria-label={
                        expandedDates[group.date] ? "Collapse" : "Expand"
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-6 w-6 transition-transform ${
                          expandedDates[group.date]
                            ? "transform rotate-180"
                            : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  {expandedDates[group.date] && (
                    <div className="p-6">
                      <ResultTable result={group.results} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
