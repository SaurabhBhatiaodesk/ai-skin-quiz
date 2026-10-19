export function emailCsv(rows: Array<{email:string;results:number;queued:number;failed:number;latestResultAt:number}>) {
 const cell=(value:unknown)=>{let text=String(value);if(/^[=+@\-\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\uFEFF'+[['Email','Results','Queued events','Failed reports','Latest result UTC'],...rows.map(r=>[r.email,r.results,r.queued,r.failed,new Date(r.latestResultAt).toISOString()])].map(row=>row.map(cell).join(',')).join('\r\n');
}
