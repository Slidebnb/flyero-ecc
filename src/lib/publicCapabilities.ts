export const publicCapabilities = {
  publicPlannerEnabled: true,
  publicInquiryEnabled: true,
  directOnlinePaymentEnabled: true,
  onlinePrintServiceEnabled: false,
  printServiceInquiryEnabled: true,
} as const;

export function getPublicPrintMessage() {
  return publicCapabilities.onlinePrintServiceEnabled
    ? "Druck kann im Ablauf mitgeplant werden."
    : "Druck wird aktuell separat mit FLYERO besprochen.";
}

export function getPublicPrintShortMessage() {
  return publicCapabilities.onlinePrintServiceEnabled ? "Druck mitplanen" : "Druck separat besprechen";
}
