/**
 * Shared form typography and input container metrics used across HomeScreen,
 * ParcelBookingView, and LocationInput so sibling field labels (PICKUP LOCATION,
 * DROPOFF LOCATION, DEPARTURE DATE, etc.) and input values render with consistent
 * visual weight, size, tracking, and height across web and native.
 */
export const FORM_LABEL_TYPOGRAPHY = {
    fontWeight: 'bold' as const,
    fontSize: 11,
    letterSpacing: 1.5,
};

export const FORM_INPUT_TEXT_TYPOGRAPHY = {
    fontSize: 15,
};

export const FORM_INPUT_BOX_METRICS = {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
};
