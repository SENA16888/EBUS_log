import { InventoryItem } from '../types';

export const normalizeBarcode = (value: string) => value.replace(/\s+/g, '').trim();

export const generateBarcode = (seed?: string) => {
  const normalizedSeed = normalizeBarcode(seed || '');
  const timePart = Date.now().toString().slice(-8);
  const randomPart = Math.floor(Math.random() * 900 + 100).toString(); // 3 digits
  const raw = `${normalizedSeed}${timePart}${randomPart}`.replace(/\D/g, '');
  const candidate = `88${raw}`;
  return candidate.slice(0, 12).padEnd(12, '0');
};

export const ensureItemBarcode = (item: InventoryItem, salt: string = ''): InventoryItem => {
  if (item.barcode && normalizeBarcode(item.barcode).length >= 6) {
    return { ...item, barcode: normalizeBarcode(item.barcode) };
  }
  return { ...item, barcode: generateBarcode(`${item.id}${salt}`) };
};

export const ensureInventoryBarcodes = (items: InventoryItem[]) => {
  const now = Date.now();
  return items.map((item, idx) => ensureItemBarcode(item, `-${idx}-${now}`));
};

export const findDuplicateBarcodeItem = (inventory: InventoryItem[], barcode?: string, excludeId?: string) => {
  const normalized = normalizeBarcode(barcode || '');
  if (!normalized) return undefined;
  return inventory.find(
    item => item.id !== excludeId && normalizeBarcode(item.barcode || '') === normalized
  );
};

export const findItemByBarcode = (inventory: InventoryItem[], code: string) => {
  const normalized = normalizeBarcode(code);
  if (!normalized) return undefined;
  return inventory.find(
    item => normalizeBarcode(item.barcode || '') === normalized || normalizeBarcode(item.id) === normalized
  );
};
