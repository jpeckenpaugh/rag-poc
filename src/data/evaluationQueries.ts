export interface EvaluationQuery {
  id: string;
  title: string;
  query: string;
  expectedResponse: string;
  evidence: string;
  type: 'answerable' | 'negative';
  category?: string;
}

export const evaluationQueries: EvaluationQuery[] = [
  {
    id: 'Q-001',
    title: 'Opening handoff record',
    query: 'What information should I record for a routine site opening handoff?',
    expectedResponse:
      'Record the date, site, scheduled handoff time, and completing role in the site\'s opening record. Use role labels rather than personal contact details in shared notes.',
    evidence:
      '[NU-OPS-002.pdf, p. 2] — “Record the date, site, scheduled opening handoff time, and completing role.”',
    type: 'answerable',
    category: 'Operational Procedures',
  },
  {
    id: 'Q-002',
    title: 'Scheduled Harbor Point exception',
    query:
      'During the approved October after-hours window, what task may the Harbor Point Site Lead perform, and when?',
    expectedResponse:
      'The Harbor Point Site Lead may inventory and relabel shelves in the designated non-clinical administrative supply storage area, Monday through Friday, October 7–11, 2024, from 18:00 to 19:30 local site time. The exception is approved but was scheduled to become effective October 7, so it was not active at the October 1 corpus snapshot.',
    evidence:
      '[NU-OPS-004.pdf, p. 1] — “Inventory and relabel shelves”; “2024-10-07 through 2024-10-11”; “18:00 to 19:30 local site time.”',
    type: 'answerable',
    category: 'Exceptions & Access',
  },
  {
    id: 'Q-003',
    title: 'Current facilities procedure',
    query:
      'Which facilities issue routing procedure is current as of October 1, 2024, and what is the status of the prior edition?',
    expectedResponse:
      'NU-OPS-003, version 2.0, is current and effective September 21, 2024. It supersedes NU-OPS-016 for facilities issue intake, routing, escalation, and follow-up. NU-OPS-016 is retained as a superseded historical copy.',
    evidence:
      '[NU-OPS-003.pdf, p. 1] — “effective 21 September 2024, this procedure supersedes NU-OPS-016”; [NU-OPS-016.pdf, p. 1] — “Superseded historical copy.”',
    type: 'answerable',
    category: 'Governance & Versioning',
  },
  {
    id: 'Q-004',
    title: 'Schedule request approval',
    query:
      'Does submitting a schedule-change request—or getting no objection—mean the change is approved?',
    expectedResponse:
      'No. A schedule change requires an explicit decision attributable to the applicable approver role. A request, copied email, draft calendar entry, or silence is not approval. The request remains pending until an explicit decision is recorded.',
    evidence:
      '[NU-OPS-005.pdf, p. 2] — “A submitted request, a copied email, a draft calendar entry, or silence does not constitute approval.”',
    type: 'answerable',
    category: 'Staff Operations',
  },
  {
    id: 'Q-005',
    title: 'General service interruption updates',
    query:
      'How often should the update owner report during an active service interruption, and what is the rule for severe-weather updates?',
    expectedResponse:
      'For a general service interruption, provide an update every 60 minutes while the interruption remains active, and sooner if there is a material status change. Severe-weather site updates follow NU-OPS-013\'s material-change and shift-handoff convention; NU-OPS-013 sets no fixed timed cadence.',
    evidence:
      '[NU-OPS-006.pdf, p. 2] — “every 60 minutes, and sooner when a material status change occurs”; [NU-OPS-013.pdf, p. 2] — next update is triggered by “material change or shift handoff.”',
    type: 'answerable',
    category: 'Incident Response',
  },
  {
    id: 'Q-006',
    title: 'operations_leads eligibility',
    query: 'Which employee IDs are eligible for documents labeled operations_leads?',
    expectedResponse:
      'EMP-001, EMP-003, EMP-005, EMP-006, EMP-007, and EMP-008. Eligibility is the explicit set for that label; the document does not imply inheritance from another access label.',
    evidence:
      '[NU-OPS-010.pdf, p. 2] — the operations_leads row lists “EMP-001, EMP-003, EMP-005, EMP-006, EMP-007, EMP-008.”',
    type: 'answerable',
    category: 'Access Control',
  },
  {
    id: 'Q-007',
    title: 'Unclear or out-of-scope record destination',
    query:
      'If a misdelivered record\'s destination is unclear or it appears to contain material outside the procedure\'s scope, what should staff do?',
    expectedResponse:
      'Do not forward it broadly. Contact the Records Coordinator for direction. The procedure also states that the directory supplies destinations but does not independently grant access to a record.',
    evidence:
      '[NU-OPS-009.pdf, p. 2] — “do not forward it broadly; contact the Records Coordinator for direction.”',
    type: 'answerable',
    category: 'Records Management',
  },
  {
    id: 'Q-008',
    title: 'Severe-weather status update fields',
    query:
      'What should the basis field in a severe-weather site update contain, and what should the next-update field avoid?',
    expectedResponse:
      'The basis should say what was directly confirmed, by which role or source, and when; distinguish direct confirmation from reports. The next-update field should identify the next trigger, such as a material change or shift handoff, and must not predict a restoration or reopening time.',
    evidence:
      '[NU-OPS-013.pdf, p. 2] — “What was directly confirmed, by which role/source, and when”; “do not enter a predicted restoration or reopening time.”',
    type: 'answerable',
    category: 'Severe Weather',
  },
  {
    id: 'Q-009',
    title: 'Vendor sign-out',
    query: 'What should the site host record before a vendor leaves?',
    expectedResponse:
      'Record the departure time, work-order or facilities issue reference, reported work status, whether the work area was returned or left awaiting follow-up, and any scope difference or discrepancy plus the role notified.',
    evidence:
      '[NU-OPS-014.pdf, p. 3] — “Before the visitor leaves, the site host role records” the departure time, reference, work status, work-area disposition, and scope differences or discrepancies.',
    type: 'answerable',
    category: 'Vendor Management',
  },
  {
    id: 'Q-010',
    title: 'Monthly site submissions',
    query: 'What must site leads submit for monthly operations metrics, and by when?',
    expectedResponse:
      'Site leads submit site-level counts with supporting record IDs, or explicitly mark the submission “not available,” to the Quality and Continuity Analyst by the fifth business day of the following month.',
    evidence:
      '[NU-OPS-019.pdf, p. 2] — “site-level counts with the supporting record IDs, or an explicit ‘not available’ status” by “the fifth business day of the following month.”',
    type: 'answerable',
    category: 'Metrics & Reporting',
  },
  {
    id: 'Q-011',
    title: 'Out of domain: medication advice',
    query: 'What dose of ibuprofen should a patient take for an ankle injury?',
    expectedResponse:
      'Abstain. The corpus contains non-clinical administrative material and provides no diagnosis or medication advice. Do not recommend a dose.',
    evidence:
      '[NU-OPS-011.pdf, p. 1] states that the guide is not clinical advice. No PDF page supports a medication dose.',
    type: 'negative',
    category: 'Out of Domain',
  },
  {
    id: 'Q-012',
    title: 'Out of domain: insurance coverage',
    query: 'Does Northstar accept my insurance plan, and what would my copay be?',
    expectedResponse:
      'Abstain. Insurance acceptance and patient billing are not covered by this operations corpus. Do not infer coverage or quote a copay.',
    evidence:
      'No supporting source or PDF page. The corpus contains no insurance-acceptance or patient-billing information.',
    type: 'negative',
    category: 'Out of Domain',
  },
  {
    id: 'Q-013',
    title: 'Not established: Friday office closing time',
    query: 'What time does the office close on Fridays?',
    expectedResponse:
      'State that the corpus does not establish regular office closing hours. Do not infer hours from the separately scoped after-hours exceptions.',
    evidence:
      'No supporting source or PDF page defines regular Friday office hours. [NU-OPS-004.pdf, p. 1] describes only a scheduled Harbor Point administrative task window, not normal office hours.',
    type: 'negative',
    category: 'Not Established',
  },
  {
    id: 'Q-014',
    title: 'Unresolved: vendor-record retention',
    query: 'How long must a site keep vendor visit and sign-in records?',
    expectedResponse:
      'State that no retention period is established in the corpus. Do not borrow a retention period from another record type.',
    evidence:
      '[NU-OPS-020.pdf, p. 2] marks the vendor visit-log retention period “Open — no answer established.”',
    type: 'negative',
    category: 'Unresolved',
  },
  {
    id: 'Q-015',
    title: 'Unresolved: Alder Creek backup',
    query: 'Who is the designated backup for the Alder Creek Site Lead?',
    expectedResponse:
      'State that the corpus does not establish a named backup or deputy. Do not infer coverage from the role mailbox.',
    evidence:
      '[NU-OPS-020.pdf, p. 1] records the backup question as open; [NU-OPS-007.pdf, p. 2] says the role mailbox does not establish backup coverage.',
    type: 'negative',
    category: 'Unresolved',
  },
];
