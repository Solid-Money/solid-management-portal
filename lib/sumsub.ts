/**
 * The applicant's page in the Sumsub dashboard.
 *
 * A FINAL Sumsub decision can only be reopened there (Change applicant status →
 * Request resubmission), so the KYC card links straight to it rather than
 * leaving the operator to search for the applicant.
 */
export function sumsubApplicantUrl(applicantId: string): string {
  return `https://cockpit.sumsub.com/checkus#/applicant/${encodeURIComponent(
    applicantId,
  )}/basicInfo`;
}
