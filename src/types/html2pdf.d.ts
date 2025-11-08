/**
 * Type declarations for html2pdf.js
 * 
 * This library converts HTML content to PDF using html2canvas and jsPDF
 */
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      logging?: boolean;
      backgroundColor?: string;
      [key: string]: any;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: string;
      [key: string]: any;
    };
    pagebreak?: {
      mode?: string | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
      [key: string]: any;
    };
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement | string): Html2PdfWorker;
    to(target: string): Html2PdfWorker;
    toPdf(): Html2PdfWorker;
    save(): Promise<void>;
    output(type: string, options?: any): Promise<any>;
    get(key: string): Promise<any>;
    then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any): Promise<any>;
  }

  function html2pdf(): Html2PdfWorker;

  namespace html2pdf {
    // Additional namespace exports if needed
  }

  export = html2pdf;
  export default html2pdf;
}

