/**
 * Type definitions for Referral-related APIs
 * Used with EZDocs CM Demo APIs at cmdemo.ezdocs.app
 */

/**
 * Referring Provider from /api/externalservice/cm/refferingprovider/list
 *
 * This API returns the list of referring providers with external IDs.
 * These providers are used as the source for referrals instead of the old provider list.
 *
 * @typedef {Object} ReferringProvider
 * @property {number} ProviderKey - Unique provider identifier (required for all subsequent operations)
 * @property {string} ProviderName - Full provider name
 * @property {string} FirstName - Provider first name
 * @property {string} LastName - Provider last name
 * @property {string} [Specialty] - Provider specialty/role
 * @property {string} [ExternalID] - External identifier used for appointment booking (replaces old external IPM key)
 * @property {string} [Phone] - Provider contact phone
 * @property {string} [Email] - Provider contact email
 * @property {boolean} [IsActive] - Whether provider is currently active
 */

/**
 * Referring Provider Location from /api/externalservice/cm/refferingprovider/locations
 *
 * Retrieved using: GET /api/externalservice/cm/refferingprovider/locations?refferingProviderKey={ProviderKey}
 * Used to allow users to select a location for the referring provider when creating a referral.
 *
 * @typedef {Object} ReferringProviderLocation
 * @property {number} LocationKey - Unique location identifier
 * @property {string} LocationDescription - Display name for the location
 * @property {string} [Phone] - Location contact phone
 * @property {string} [Address1] - Primary street address
 * @property {string} [Address2] - Secondary address line (suite, unit, etc.)
 * @property {string} [City] - City name
 * @property {string} [State] - State code (e.g., "CA", "NY")
 * @property {string} [Zip] - Postal code
 * @property {string} [ExternalIPMKey] - Legacy external key (if still required)
 * @property {number} [Latitude] - Geographic latitude
 * @property {number} [Longitude] - Geographic longitude
 * @property {boolean} [IsActive] - Whether location is currently active
 */

/**
 * Referral Schedule from /api/externalservice/cm/referralschedules/list
 *
 * Retrieved using: GET /api/externalservice/cm/referralschedules/list?referralKey={ReferralKey}
 * Represents appointments/schedules associated with a specific referral.
 *
 * @typedef {Object} ReferralSchedule
 * @property {number} ReferralScheduleKey - Unique schedule identifier
 * @property {number} ReferralKey - Associated referral identifier (from Add Referral response)
 * @property {number} PatientKey - Patient identifier
 * @property {string} Status - Current status (e.g., "Open", "InProcess", "Completed", "Cancelled")
 * @property {string} [Comments] - Free-text comments (e.g., reason, metadata)
 * @property {string} StartDateTime - Appointment start (ISO 8601 format, e.g., "2025-12-04T14:30:00")
 * @property {string} EndDateTime - Appointment end (ISO 8601 format, e.g., "2025-12-04T15:15:00")
 * @property {string} [ProviderName] - Provider associated with this schedule
 * @property {string} [LocationName] - Location associated with this schedule
 * @property {string} [CreatedDate] - When this schedule was created
 * @property {string} [ModifiedDate] - Last modification timestamp
 */

/**
 * Request body for POST /api/externalservice/cm/referralschedules/add
 *
 * Used to book a new appointment for an existing referral.
 * Must be called AFTER creating the referral and obtaining the ReferralKey.
 *
 * @typedef {Object} AddReferralScheduleRequest
 * @property {number} ReferralKey - Required: ReferralKey obtained from Add Referral API response
 * @property {number} PatientKey - Required: Patient identifier
 * @property {string} StartDateTime - Required: ISO 8601 datetime (e.g., "2025-12-04T14:30:00")
 * @property {string} EndDateTime - Required: ISO 8601 datetime (e.g., "2025-12-04T15:15:00")
 * @property {string} Status - Required: Initial status (typically "Open")
 * @property {string} [Comments] - Optional: Free-text comments
 *
 * @example
 * {
 *   "ReferralKey": 12007,
 *   "PatientKey": 5565,
 *   "StartDateTime": "2025-12-04T14:30:00",
 *   "EndDateTime": "2025-12-04T15:15:00",
 *   "Status": "Open",
 *   "Comments": "FU- REFF BY: IPM REP BY: VISHAL"
 * }
 */

/**
 * Response from POST /api/externalservice/cm/referralschedules/add
 *
 * @typedef {Object} AddReferralScheduleResponse
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} message - Success or error message
 * @property {ReferralSchedule} [result] - The created schedule record (if successful)
 */

/**
 * Enhanced referral record with IN-type provider+location data
 *
 * This extends the existing referral structure to include:
 * - Hospital (existing)
 * - Agent (existing)
 * - Referring Provider + Location (NEW IN-type record)
 *
 * @typedef {Object} ReferralRecord
 * @property {number} ReferralKey - Unique referral identifier (captured from API response)
 * @property {number} PatientKey - Associated patient
 * @property {string} ReferralDate - Date of referral
 * @property {string} ReferralType - Type ("In" or "Out")
 * @property {Object} ReferredBy - Source of the referral
 * @property {number} ReferredBy.Id - Source ID
 * @property {string} ReferredBy.Name - Source name
 * @property {string} ReferredBy.Type - Source type: "Agent", "Hospital", or "Provider"
 * @property {ReferringProviderInfo} [ReferringProvider] - NEW: Referring provider details (IN-type)
 * @property {ReferringProviderLocation} [ReferringProviderLocation] - NEW: Selected location for provider
 */

/**
 * Referring Provider Info for storage in referral record
 *
 * @typedef {Object} ReferringProviderInfo
 * @property {number} ProviderKey - Provider identifier
 * @property {string} ProviderName - Provider display name
 * @property {string} [ExternalID] - External ID for appointment operations
 */

export default {
  // Export types for JSDoc usage
};
