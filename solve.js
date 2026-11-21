// A faster drop-in for csv-reader 1.0.0.
//
// run(input) returns exactly what the reference returns for {text, header}:
// {columns, rows, errors}. It reads the text once, left to right, but jumps
// between delimiters with indexOf and slices whole fields, instead of walking
// one character at a time. Quoted fields are closed by an indexOf scan and
// their contents converted in bulk; line breaks inside them are counted with
// a single regex match.

const C_COMMA = 44; // ,
const C_QUOTE = 34; // "
const C_LF = 10; // \n
const C_CR = 13; // \r
const C_BOM = 0xfeff;

/** How the field just read ended. */
const F_COMMA = 0;
const F_BREAK = 1;
const F_END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === C_BOM) pos = 1;

  let recordLine = 1;
  let recordRow = null;
  let lineEnd = -1; // next LF at or after pos, or -1 when there is none
  let lineHasCR = false; // a CR sits on the current line before its break
  let ended = F_COMMA; // how the last field ended
  let added = 0; // characters the last unquoted read kept

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Refresh the current line's end and whether it holds a CR. The CR of a
  // CRLF line break is the break's own, not a stray one, so it does not count.
  function refreshLine() {
    lineEnd = text.indexOf('\n', pos);
    lineHasCR = false;
    const crAt = text.indexOf('\r', pos);
    if (crAt !== -1) {
      if (lineEnd === -1) lineHasCR = true;
      else if (crAt < lineEnd - 1) lineHasCR = true;
    }
  }

  // Read an unquoted field from pos, starting from `base` ('' for a plain
  // field, '"' for an unterminated quote's re-read, the quoted value for
  // junk after a closing quote). Sets ended and added.
  function unquoted(base) {
    const comma = text.indexOf(',', pos);
    let end;
    if (comma !== -1 && (lineEnd === -1 || comma < lineEnd)) {
      end = comma;
      ended = F_COMMA;
    } else if (lineEnd !== -1) {
      end = lineEnd;
      ended = F_BREAK;
    } else {
      end = n;
      ended = F_END;
    }
    // A CR just before the line break belongs to the CRLF, not the field.
    let fieldEnd = end;
    if (ended === F_BREAK && text.charCodeAt(end - 1) === C_CR) fieldEnd = end - 1;
    let value = text.slice(pos, fieldEnd);
    if (ended === F_COMMA) pos = comma + 1;
    else if (ended === F_BREAK) {
      pos = end + 1;
      line += 1;
    } else pos = n;
    added = value.length;
    // Any CR left in the value is a stray one: drop it and record it. The
    // line is checked for CRs once, so most fields skip this scan entirely.
    if (lineHasCR && value.indexOf('\r') !== -1) {
      const parts = value.split('\r');
      for (let k = 1; k < parts.length; k++) pushError('stray_cr');
      value = parts.join('');
      added = value.length;
    }
    return base === '' ? value : base + value;
  }

  // Read a quoted field whose opening quote is at pos. Sets ended and added.
  function quoted() {
    const open = pos;
    const openLine = line;
    let p = pos + 1;
    let doubled = false;
    let close = -1;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === C_QUOTE) {
        doubled = true;
        p = q + 2;
        continue;
      }
      close = q;
      break;
    }
    if (close === -1) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted, from the line it opened on.
      pos = open + 1;
      line = openLine;
      pushError('unterminated_quote');
      return unquoted('"');
    }
    let value = text.slice(open + 1, close);
    if (doubled) value = value.replace(/""/g, '"');
    // The closing quote sits past the line's break only when the content
    // crossed a line; a lone CR can only hide in the value when the line
    // itself holds one. Both checks cost nothing in the common case.
    const crossed = lineEnd !== -1 && close > lineEnd;
    if (crossed || (lineHasCR && value.indexOf('\r') !== -1)) {
      // Each CRLF or lone CR inside reads as LF; every line break inside
      // counts, and the field may span lines, so the line end moves.
      const breaks = value.match(/\r\n|\r|\n/g);
      line += breaks.length;
      if (value.indexOf('\r') !== -1) value = value.replace(/\r\n?/g, '\n');
    }
    pos = close + 1;
    if (crossed) refreshLine();
    added = 0;
    if (pos >= n) {
      ended = F_END;
      return value;
    }
    const c = text.charCodeAt(pos);
    if (c === C_COMMA) {
      pos += 1;
      ended = F_COMMA;
      return value;
    }
    if (c === C_LF) {
      pos += 1;
      line += 1;
      ended = F_BREAK;
      return value;
    }
    if (c === C_CR && text.charCodeAt(pos + 1) === C_LF) {
      pos += 2;
      line += 1;
      ended = F_BREAK;
      return value;
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break; junk counts only when it kept characters.
    const junk = unquoted(value);
    if (added > 0) pushError('quote_junk');
    return junk;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === C_LF) {
        pos += 1;
        line += 1;
      } else if (c === C_CR && text.charCodeAt(pos + 1) === C_LF) {
        pos += 2;
        line += 1;
      } else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    refreshLine();

    const fields = [];
    let lastQuoted = false;
    do {
      let v;
      if (text.charCodeAt(pos) === C_QUOTE) {
        lastQuoted = true;
        v = quoted();
      } else {
        lastQuoted = false;
        v = unquoted('');
      }
      fields.push(v);
    } while (ended === F_COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
