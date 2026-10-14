// Reuse the same local font stylesheet in every standalone print document.
export const getTypographyHead = (): string => {
  const stylesheet = document.querySelector<HTMLLinkElement>('link[data-app-typography]');
  const href = stylesheet?.href || new URL('typography.css', document.baseURI).href;
  const escapedHref = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<meta charset="UTF-8"><link rel="stylesheet" href="${escapedHref}" data-app-typography>`;
};

export const printWhenFontsReady = async (printWindow: Window): Promise<void> => {
  const stylesheet = printWindow.document.querySelector<HTMLLinkElement>('link[data-app-typography]');
  // A freshly written about:blank window can still report "complete" before its CSS loads.
  const fontFamily = printWindow.getComputedStyle(printWindow.document.documentElement)
    .getPropertyValue('--app-font-family');
  if (stylesheet && !fontFamily) {
    await new Promise<void>(resolve => {
      stylesheet.addEventListener('load', () => resolve(), { once: true });
      stylesheet.addEventListener('error', () => resolve(), { once: true });
    });
  }
  if (printWindow.document.readyState !== 'complete') {
    await new Promise<void>(resolve => printWindow.addEventListener('load', () => resolve(), { once: true }));
  }
  // Force layout so newly inserted text requests the font before checking readiness.
  void printWindow.document.body.offsetHeight;
  await printWindow.document.fonts.ready;
  if (!printWindow.closed) printWindow.print();
};
