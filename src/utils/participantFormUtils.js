/**
 * Participant Form Validation & Helper Utilities
 * Single source of truth for participant form validation in Task Grade.
 */

/**
 * Filter to get only valid, selected participant fields
 * (excludes deleted, unselected, disabled, or empty-labeled fields)
 * @param {Array} fields 
 * @returns {Array}
 */
export const getValidParticipantFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  return fields.filter((field) => {
    if (!field || typeof field !== 'object') return false;
    // Exclude unselected or disabled fields
    if (field.selected === false || field.disabled === true) return false;
    // Must have a non-empty string label
    const label = typeof field.label === 'string' ? field.label.trim() : '';
    return label.length > 0;
  });
};

/**
 * Calculates the total number of selected participant fields:
 * - Default Name field (if present and selected)
 * - Every selected Quick Field
 * - Every selected Custom Field
 * @param {Array} fields 
 * @returns {number}
 */
export const calculateTotalSelectedParticipantFields = (fields) => {
  return getValidParticipantFields(fields).length;
};

/**
 * Validates whether the participant form satisfies the core requirement:
 * totalSelectedParticipantFields >= 1
 * @param {Array} fields 
 * @returns {boolean}
 */
export const isParticipantFormValid = (fields) => {
  return calculateTotalSelectedParticipantFields(fields) >= 1;
};

