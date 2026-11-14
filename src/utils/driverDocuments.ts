export const MIN_REQUIRED_DRIVER_DOCS = 3;
export const TOTAL_DRIVER_DOC_SLOTS = 5;

export type DriverDocFormKey = 'dl' | 'rc' | 'pollution' | 'image' | 'ownership';
export type DriverDocCamelKey = 'dlUrl' | 'rcUrl' | 'pollutionUrl' | 'vehicleImageUrl' | 'ownershipUrl';
export type DriverDocSnakeKey = 'dl_url' | 'rc_url' | 'pollution_url' | 'vehicle_image_url' | 'ownership_url';

export interface DriverDocSlotMeta {
    formKey: DriverDocFormKey;
    camelKey: DriverDocCamelKey;
    snakeKey: DriverDocSnakeKey;
    shortLabel: string;
    label: string;
    adminTitle: string;
    sub: string;
    recommended: boolean;
}

export const DRIVER_DOC_SLOTS: readonly DriverDocSlotMeta[] = [
    {
        formKey: 'dl',
        camelKey: 'dlUrl',
        snakeKey: 'dl_url',
        shortLabel: 'DL',
        label: 'Driving License',
        adminTitle: '1. Driving License (DL)',
        sub: 'Front and back of your DL',
        recommended: true,
    },
    {
        formKey: 'rc',
        camelKey: 'rcUrl',
        snakeKey: 'rc_url',
        shortLabel: 'RC',
        label: 'RC Book',
        adminTitle: '2. RC Book (Registration Certificate)',
        sub: 'Vehicle Registration Certificate',
        recommended: true,
    },
    {
        formKey: 'pollution',
        camelKey: 'pollutionUrl',
        snakeKey: 'pollution_url',
        shortLabel: 'PUC',
        label: 'Pollution Certificate',
        adminTitle: '3. Pollution Certificate (PUC)',
        sub: 'Valid PUC Certificate',
        recommended: true,
    },
    {
        formKey: 'image',
        camelKey: 'vehicleImageUrl',
        snakeKey: 'vehicle_image_url',
        shortLabel: 'Photo',
        label: 'Vehicle Photo',
        adminTitle: '4. Vehicle Photo (Number Plate Visible)',
        sub: 'Number plate must be clearly visible',
        recommended: true,
    },
    {
        formKey: 'ownership',
        camelKey: 'ownershipUrl',
        snakeKey: 'ownership_url',
        shortLabel: 'Owner',
        label: 'Ownership Proof',
        adminTitle: '5. Ownership Proof (Optional)',
        sub: 'Any document establishing owner-vehicle relation',
        recommended: false,
    },
] as const;

export type DriverDocSource = Partial<
    Record<DriverDocFormKey | DriverDocCamelKey | DriverDocSnakeKey, string | null | undefined>
> & {
    documentCount?: number | null;
};

export interface DriverDocEntry {
    slot: DriverDocSlotMeta;
    url: string;
}

function readSlotUrl(source: DriverDocSource | null | undefined, slot: DriverDocSlotMeta): string {
    if (!source) return '';
    const candidate = source[slot.formKey] ?? source[slot.camelKey] ?? source[slot.snakeKey];
    return typeof candidate === 'string' ? candidate.trim() : '';
}

export function getDriverDocEntries(source?: DriverDocSource | null): DriverDocEntry[] {
    return DRIVER_DOC_SLOTS.map((slot) => ({
        slot,
        url: readSlotUrl(source, slot),
    }));
}

export function extractDriverDocUrls(source?: DriverDocSource | null): string[] {
    return getDriverDocEntries(source)
        .map((entry) => entry.url)
        .filter((url) => url.length > 0);
}

/**
 * Counts distinct non-empty trimmed URLs across all 5 driver/vehicle document slots.
 * Deduplicating matches the backend rule so reusing the same URL in multiple slots
 * cannot bypass the 3-document minimum.
 */
export function countDistinctDriverDocs(source?: DriverDocSource | null): number {
    return new Set(extractDriverDocUrls(source)).size;
}

export function getDriverDocCount(source?: DriverDocSource | null): number {
    const urls = extractDriverDocUrls(source);
    if (urls.length > 0) {
        return new Set(urls).size;
    }
    if (typeof source?.documentCount === 'number' && Number.isFinite(source.documentCount)) {
        return Math.max(0, Math.min(TOTAL_DRIVER_DOC_SLOTS, Math.trunc(source.documentCount)));
    }
    return 0;
}

export function hasMinimumDriverDocs(
    source?: DriverDocSource | null,
    minDocs: number = MIN_REQUIRED_DRIVER_DOCS,
): boolean {
    return getDriverDocCount(source) >= minDocs;
}

export function getDriverDocProgressLabel(
    source?: DriverDocSource | null,
    minDocs: number = MIN_REQUIRED_DRIVER_DOCS,
): string {
    const count = getDriverDocCount(source);
    if (count >= minDocs) {
        return `${count}/${TOTAL_DRIVER_DOC_SLOTS} uploaded · Ready (min ${minDocs} met)`;
    }
    const remaining = minDocs - count;
    return `${count}/${TOTAL_DRIVER_DOC_SLOTS} uploaded · Upload ${remaining} more (min ${minDocs} distinct docs)`;
}

export function validateMinimumDriverDocs(
    source?: DriverDocSource | null,
    minDocs: number = MIN_REQUIRED_DRIVER_DOCS,
): string | null {
    const distinctCount = getDriverDocCount(source);
    if (distinctCount >= minDocs) {
        return null;
    }
    const rawCount = extractDriverDocUrls(source).length;
    if (rawCount >= minDocs) {
        return `Please upload ${minDocs} distinct vehicle documents (duplicate document URLs cannot be counted twice).`;
    }
    return `Please upload at least ${minDocs} distinct vehicle documents (${distinctCount}/${minDocs} uploaded).`;
}
