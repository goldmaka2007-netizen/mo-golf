import fs from 'node:fs';
import path from 'node:path';

type CsvRow = Record<string, string>;

const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length || record.length) {
    record.push(field);
    records.push(record);
  }
  const headers = records.shift() ?? [];
  return records
    .filter(row => row.some(value => value !== ''))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const root = process.cwd();
const approvedRows = parseCsv(fs.readFileSync(path.join(root, 'approved_normalized_preview.csv'), 'utf8'));
const pilot = JSON.parse(fs.readFileSync(path.join(root, 'pilot_rollback_manifest.json'), 'utf8')) as {
  ids: string[];
};
const pilotIds = new Set(pilot.ids);
const ids = approvedRows.map(row => row.document_id);
const createdIds = ids.filter(id => !pilotIds.has(id));

if (ids.length !== 2169 || pilotIds.size !== 30 || createdIds.length !== 2139) {
  throw new Error(`Manifest count mismatch: all=${ids.length}, pilot=${pilotIds.size}, created=${createdIds.length}`);
}

fs.writeFileSync(path.join(root, 'full_rollback_manifest.json'), `${JSON.stringify({
  status: 'ready_not_executed_verification_passed',
  preparedBeforeWriteAt: '2026-07-23T12:37:22.452Z',
  finalizedAfterIdempotencyVerificationAt: new Date().toISOString(),
  projectId: 'makka-central-accounting',
  collection: 'entries',
  sourceHash: '0f80dc5a76d43e0c588f02ef4574543aecb6d8825419f31ded1af3de27a37892',
  importVersion: 'csv-2026-07-23-v1',
  totalApprovedIds: ids.length,
  preexistingPilotIds: pilot.ids,
  createdByFullImportIds: createdIds,
  ids,
  rollbackScope: 'createdByFullImportIds_only_never_preexistingPilotIds',
  rollbackExecuted: false,
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  status: 'ready_not_executed_verification_passed',
  totalApprovedIds: ids.length,
  preexistingPilotIds: pilotIds.size,
  createdByFullImportIds: createdIds.length,
}));
