# MASTER PROMPT: VETLINK COMPLETE CLINIC PERSONNEL AND SYSTEM ADMINISTRATOR WEB APPLICATION

## 1. PROJECT OVERVIEW

Act as a senior UI/UX designer, enterprise SaaS product designer, and professional Figma design engineer.

Your task is to design the COMPLETE HIGH-FIDELITY WEB APPLICATION INTERFACES for the Clinic Personnel and System Administrator modules of VetLink.

**Project Title:**

VetLink: A Mobile-Based Veterinary Clinic Locator, Appointment Booking, and Pet Health Record Management System.

VetLink is a cross-platform, multi-clinic veterinary management platform that connects pet owners with multiple independent veterinary clinics.

The Pet Owner Mobile Application has already been designed separately.

Your task is to create the complete WEB-BASED INTERFACES ONLY for the following five user roles:

1. Clinic Administrator
2. Appointment Manager / Receptionist
3. Veterinarian
4. Clinic Staff
5. System Administrator

Additionally, create the public-facing clinic registration and authentication pages required for clinics to join and access the VetLink platform.

This must be a complete application design, not merely a collection of sample dashboards.

Generate all required screens, navigation structures, forms, tables, modals, detail pages, confirmation screens, and interaction states.

Do not omit important pages or replace complete workflows with simple placeholder screens.

---

# 2. STRICT PLATFORM REQUIREMENTS

DESIGN WEB APPLICATIONS ONLY.

Do not generate:
- iPhone frames.
- Android frames.
- Mobile application screens.
- Mobile onboarding pages.
- Mobile bottom navigation.
- Tablet-specific interfaces.
- Mobile versions of the dashboards.

### Desktop specifications

- Primary frame: 1440 × 900 px.
- Orientation: Landscape.
- Design fidelity: High-fidelity.
- Layout: Desktop web application.
- Sidebar: Vertical navigation.
- Header: Horizontal top navigation.
- Content: Responsive desktop dashboard layout.
- Components: Reusable with variants.
- Use Auto Layout wherever appropriate.

The result must resemble a professional enterprise SaaS veterinary clinic management platform.

---

# 3. OFFICIAL VETLINK BRANDING AND DESIGN SYSTEM

Use the SAME branding established in the completed VetLink Pet Owner Mobile Application.

Do not invent an entirely new visual identity.

### Brand identity

Application name: VetLink

Tagline: Veterinary Care, Connected.

### Official color palette

Primary:
- Deep Burgundy: #720B0B

Secondary:
- Soft Peach: #F4C5B9

Accent:
- Warm Orange: #FF6B00

Main surface:
- Pure White: #FFFFFF

Supporting colors:
- Secondary Burgundy: #8E2026
- Blush: #E8C7BB
- Dark Text: #1F2937
- Secondary Text: #64748B
- Border: #E2E8F0
- Success: #16A34A
- Warning: #DC8A25
- Error: #DC4545
- Information: #3185D6

### CRITICAL BACKGROUND REQUIREMENT

Use SOLID PURE WHITE (#FFFFFF) for all main application backgrounds and white content surfaces.

Do not use:
- #FAF8F6
- #F9F9F9
- #F5F5F5
- Cream.
- Ivory.
- Warm white.
- Grayish-white backgrounds.

Avoid unwanted gradients, opacity overlays, or tinted backgrounds on the main content surfaces.

Light gray may only be used for subtle borders, dividers, and secondary visual distinctions.

### Branding rules

- Use the existing VetLink paw logo.
- Use Deep Burgundy for primary buttons and important navigation elements.
- Use Soft Peach for secondary elements.
- Use Warm Orange for small branding accents.
- Maintain consistent visual identity across all five roles.
- Use the same design language as the Pet Owner application.

### Typography

Use Inter as the primary typeface.

Typography specifications:
- Page headings: 26–30 px, Bold.
- Section headings: 20–22 px, Semibold.
- Card headings: 16–18 px, Semibold.
- Body text: 14–16 px.
- Form labels: 13–14 px.
- Supporting text: 12–13 px.

### Design style

Create a modern, clean, professional, organized, and visually balanced enterprise interface.

Use:
- Clean white surfaces.
- Burgundy primary buttons.
- Consistent sidebar navigation.
- Organized data tables.
- Statistics cards.
- Professional charts.
- Subtle shadows.
- Light borders.
- Consistent spacing.
- Professional icons.
- Clear information hierarchy.

Avoid:
- Overcrowded layouts.
- Excessive gradients.
- Excessive decorative illustrations.
- Childish graphics.
- Oversized headings.
- Unnecessary animations.
- Inconsistent component styles.

---

# 4. GLOBAL WEB APPLICATION LAYOUT

Create a consistent and reusable dashboard layout for all five roles.

### A. Left Sidebar

Include:
- VetLink logo.
- Role-specific navigation.
- Navigation icons.
- Active navigation indicator.
- Expandable navigation groups where appropriate.
- User profile section.
- Logout action.

Each role must have its own appropriate navigation menu.

### B. Top Header

Include:
- Breadcrumb navigation.
- Page title where appropriate.
- Search or quick actions.
- Notification bell.
- User profile avatar.
- User name.
- Assigned role.
- Clinic identification when applicable.

### C. Main Content Area

Include:
- Page heading.
- Supporting description.
- Primary action buttons.
- Statistics cards.
- Data tables.
- Search fields.
- Filters.
- Pagination.
- Forms.
- Charts.
- Detail panels.

Maintain the same layout structure while adjusting the navigation and content for each user role.

---

# PART A: AUTHENTICATION AND PUBLIC CLINIC REGISTRATION

# 5. CLINIC PERSONNEL AUTHENTICATION

Create a professional authentication experience for all clinic personnel.

### Screen AUTH-01 – Clinic Personnel Login

Include:
- VetLink logo.
- Welcome Back heading.
- Short supporting description.
- Email address.
- Password.
- Show/hide password.
- Remember Me checkbox.
- Forgot Password link.
- Login button.
- Professional veterinary-themed visual.
- Clean and minimal layout.

All clinic personnel use the same login entry point.

After successful authentication, direct the user to the correct dashboard based on their assigned role.

### Screen AUTH-02 – Forgot Password

Include:
- Email address input.
- Password recovery instructions.
- Send Reset Link button.
- Return to Login link.

### Screen AUTH-03 – Reset Password

Include:
- New Password.
- Confirm Password.
- Password requirements.
- Show/hide password.
- Reset Password button.

### Screen AUTH-04 – Email Verification

Include:
- Verification instructions.
- Email address.
- Verification code fields.
- Resend Code button.
- Verify button.

### Screen AUTH-05 – First-Time Account Activation

Include:
- Account invitation message.
- Email information.
- Create password.
- Confirm password.
- Accept account invitation.
- Activate Account button.

### Screen AUTH-06 – Complete Staff Profile

Include:
- Profile photograph upload.
- First name.
- Last name.
- Contact number.
- Email address.
- Assigned role.
- Save Profile button.

### Screen AUTH-07 – Access Restricted

Include:
- Access denied icon.
- Restricted access message.
- Explanation of insufficient permissions.
- Return to Dashboard button.

---

# 6. PUBLIC VETERINARY CLINIC REGISTRATION

VetLink is a multi-clinic platform.

Independent veterinary clinics must be able to submit registration applications to join VetLink.

Create a professional public-facing registration process.

The registration must NOT automatically grant clinic management access.

Every submitted application must undergo System Administrator review and approval.

### Screen REG-01 – Clinic Registration Landing Page

Include:
- VetLink branding.
- Welcome to VetLink heading.
- Short explanation of the multi-clinic platform.
- Benefits of joining VetLink.
- Register Your Clinic button.
- Already Registered? Login link.

### Screen REG-02 – Create Clinic Administrator Account

Fields:
- First name.
- Last name.
- Email address.
- Contact number.
- Password.
- Confirm password.
- Terms and Privacy Policy acceptance.

Button: Continue.

The person submitting the registration becomes the proposed Clinic Administrator, subject to application approval.

### Screen REG-03 – Clinic Information Registration

Fields:
- Official clinic name.
- Clinic description.
- Clinic category.
- Year established, if applicable.
- Clinic contact number.
- Official email address.
- Website, if applicable.

### Screen REG-04 – Clinic Address and Location

Fields:
- Province.
- City or municipality.
- Barangay.
- Complete street address.
- Location information.
- Map location selection.

Use a clean address form and location selection interface.

### Screen REG-05 – Clinic Services and Operating Hours

Include:
- Available veterinary services.
- Service descriptions.
- Operating days.
- Opening time.
- Closing time.
- Break schedules when applicable.
- Emergency service availability.

### Screen REG-06 – Upload Clinic Documents

Include:
- Clinic verification document upload.
- Relevant business or clinic registration documents.
- Veterinary credentials or supporting documents where applicable.
- File upload indicators.
- Uploaded file list.
- Remove and replace actions.

Clearly label documents as required or optional according to the configured registration requirements.

### Screen REG-07 – Review Registration Information

Display a complete summary of:
- Applicant information.
- Clinic information.
- Address.
- Contact details.
- Services.
- Operating hours.
- Submitted documents.

Include Edit and Submit Application buttons.

### Screen REG-08 – Registration Successfully Submitted

Display:
- Success icon.
- Application submitted message.
- Application reference number.
- Submission date.
- Expected review status.
- Return to Login or Registration Status button.

### Screen REG-09 – Registration Pending Approval

Display:
- Pending application status.
- Application reference.
- Clinic name.
- Submission date.
- Review status.
- Explanation that access will be provided after approval.

### Screen REG-10 – Registration Rejected / Additional Information Required

Include:
- Application status.
- Review remarks.
- Rejection reason or requested corrections.
- Resubmit Information button when applicable.
- Contact Support option.

---

# 7. SYSTEM ADMINISTRATOR AUTHENTICATION

The System Administrator must have a dedicated, secure authentication experience.

### Screen SA-AUTH-01 – System Administrator Login

Include:
- VetLink logo.
- System Administrator Login heading.
- Email.
- Password.
- Show/hide password.
- Forgot Password.
- Login button.
- Secure administration visual.

Use a professional and slightly distinct layout while preserving the same branding.

### Screen SA-AUTH-02 – Forgot Password

Include email input and password recovery instructions.

### Screen SA-AUTH-03 – Reset Password

Include new password, confirmation, and password requirements.

### Screen SA-AUTH-04 – Account Verification

Include verification code, resend code, and confirmation.

IMPORTANT:

Do not create a public System Administrator signup page.

System Administrator accounts must be provisioned through a secure authorized process.

---

# PART B: CLINIC PERSONNEL INTERFACES

# 8. CLINIC ADMINISTRATOR INTERFACE

The Clinic Administrator manages ONE assigned veterinary clinic.

The administrator is responsible for clinic information, staff accounts, services, clinic operations, and authorized clinic records.

The Clinic Administrator must not access the private data of other independent clinics.

### Screen CA-01 – Clinic Administrator Dashboard

Statistics cards:
- Total Appointments.
- Pending Appointments.
- Registered Pet Owners.
- Registered Pets.
- Active Veterinary Staff.

Dashboard sections:
- Appointment overview.
- Recent appointment requests.
- Today's appointment schedule.
- Clinic activity.
- Staff overview.
- Appointment status chart.
- Quick actions.

Include clinic name and clinic identification.

### Screen CA-02 – Clinic Profile

Include:
- Clinic logo.
- Cover photograph.
- Clinic name.
- Address.
- Contact number.
- Email.
- Clinic description.
- Operating hours.
- Clinic status.
- Edit Clinic Profile button.

### Screen CA-03 – Edit Clinic Information

Fields:
- Clinic name.
- Description.
- Address.
- Contact number.
- Email.
- Operating hours.
- Location.
- Clinic logo upload.
- Cover photograph upload.

### Screen CA-04 – Clinic Services Management

Include:
- Services table.
- Service name.
- Description.
- Service category.
- Availability.
- Edit action.
- Add Service button.
- Deactivate service action.

### Screen CA-05 – Add New Service

Fields:
- Service name.
- Service description.
- Service category.
- Service availability.
- Additional information.

Include Save and Cancel.

### Screen CA-06 – Staff Management

Create a complete staff directory.

Columns:
- Staff photograph.
- Full name.
- Email.
- Contact number.
- Assigned role.
- Account status.
- Actions.

Include:
- Search.
- Filters.
- Add Staff.
- Edit.
- View Details.
- Deactivate Account.

### Screen CA-07 – Add Staff Account

Fields:
- First name.
- Last name.
- Email.
- Contact number.
- Assigned role.
- Account status.

Available roles:
- Appointment Manager / Receptionist.
- Veterinarian.
- Clinic Staff.

Include Send Invitation functionality.

Staff members must receive an invitation to activate their accounts.

### Screen CA-08 – Staff Details

Include:
- Staff profile.
- Assigned role.
- Contact details.
- Account status.
- Account creation date.
- Assigned permissions.
- Edit Staff action.

### Screen CA-09 – Staff Permissions

Permission categories:
- Appointment management.
- Owner information.
- Pet information.
- Medical record access.
- Vaccination record access.
- Clinic information.
- Reports.
- Staff management.

Use clear permission indicators and access controls.

### Screen CA-10 – Clinic Reports

Include:
- Appointment reports.
- Pet registration reports.
- Owner registration reports.
- Service utilization.
- Clinic activity.
- Date filters.
- Export controls.

### Screen CA-11 – Data Import and Export

Include:
- Export clinic records.
- Import supported records.
- File upload.
- Export format selection.
- Import validation.
- Data backup history.
- Import and export activity.

Include confirmation dialogs for sensitive operations.

### Screen CA-12 – Clinic Notifications

Include:
- Appointment alerts.
- Staff account notifications.
- Clinic updates.
- Read/unread states.
- Notification details.

### Screen CA-13 – Clinic Settings

Include:
- Clinic preferences.
- Operating hours.
- Appointment settings.
- Notification preferences.
- Account security.
- Profile settings.

---

# 9. APPOINTMENT MANAGER / RECEPTIONIST INTERFACE

The Appointment Manager is responsible for front desk operations, appointment requests, appointment schedules, owner registration, and pet registration assistance.

### Screen AM-01 – Appointment Manager Dashboard

Statistics:
- Today's Appointments.
- Pending Requests.
- Confirmed Appointments.
- Completed Appointments.
- Cancelled Appointments.

Sections:
- Today's schedule.
- Pending booking requests.
- Upcoming appointments.
- Recent registrations.
- Quick appointment actions.

### Screen AM-02 – Appointment Management

Create a complete appointment table.

Columns:
- Appointment Reference.
- Pet Name.
- Owner Name.
- Veterinary Service.
- Appointment Date.
- Appointment Time.
- Assigned Veterinarian.
- Appointment Status.
- Actions.

Include:
- Search.
- Date filter.
- Status filter.
- Service filter.
- Pagination.
- View Details.

### Screen AM-03 – Appointment Requests

Include:
- Incoming appointment requests.
- Pet information.
- Owner information.
- Requested service.
- Preferred date and time.
- Approve.
- Reject.
- Request Rescheduling.

### Screen AM-04 – Appointment Details

Include:
- Appointment reference.
- Owner information.
- Pet information.
- Requested service.
- Appointment date and time.
- Additional notes.
- Appointment status.
- Assigned veterinarian.
- Booking activity history.

### Screen AM-05 – Schedule Calendar

Create a professional scheduling calendar.

Calendar views:
- Daily.
- Weekly.
- Monthly.

Display:
- Appointment time.
- Pet name.
- Owner name.
- Assigned veterinarian.
- Status indicators.

### Screen AM-06 – Create Appointment

Fields:
- Select registered pet owner.
- Select pet.
- Select service.
- Select veterinarian when applicable.
- Appointment date.
- Appointment time.
- Reason for visit.
- Additional notes.

### Screen AM-07 – Reschedule Appointment

Include:
- Existing appointment summary.
- New date.
- Available time slots.
- Reason for rescheduling.
- Confirm Reschedule button.

### Screen AM-08 – Cancel Appointment

Include:
- Appointment information.
- Cancellation reason.
- Confirmation dialog.
- Confirm Cancellation button.

### Screen AM-09 – Pet Owner Management

Create a registered owner table.

Columns:
- Owner name.
- Email.
- Contact number.
- Number of registered pets.
- Registration date.
- Actions.

Include search and filters.

### Screen AM-10 – Register Pet Owner

Fields:
- First name.
- Last name.
- Email.
- Contact number.
- Address.
- Other required registration information.

### Screen AM-11 – Pet Registration Management

Include:
- Pet photograph.
- Pet name.
- Species.
- Breed.
- Owner.
- Registration date.
- View Profile action.

### Screen AM-12 – Pet Details

Include:
- Pet photograph.
- Pet name.
- Species.
- Breed.
- Gender.
- Date of birth.
- Weight.
- Owner information.
- Medical record overview where permitted.

### Screen AM-13 – Client Inquiry Management

Include:
- Inquiry list.
- Owner name.
- Pet name.
- Inquiry category.
- Submission date.
- Inquiry status.
- View Details.
- Forward inquiry to authorized veterinary personnel when appropriate.

### Screen AM-14 – Appointment Notifications

Include:
- Pending booking notifications.
- Confirmed appointment alerts.
- Cancellation notifications.
- Rescheduling requests.
- Read/unread indicators.

---

# 10. VETERINARIAN INTERFACE

The Veterinarian interface focuses on patient consultations, medical documentation, treatment information, and vaccination management.

### Screen VET-01 – Veterinarian Dashboard

Statistics:
- Today's Consultations.
- Upcoming Appointments.
- Completed Consultations.
- Pending Medical Records.

Sections:
- Today's patient schedule.
- Upcoming consultations.
- Recent patient records.
- Consultation history.
- Quick access to pet records.

### Screen VET-02 – Appointment List

Columns:
- Appointment Reference.
- Pet Name.
- Owner Name.
- Service.
- Date.
- Time.
- Status.
- Actions.

Include date and status filters.

### Screen VET-03 – Patient Details

Include:
- Pet profile.
- Owner details.
- Medical history.
- Vaccination status.
- Previous consultations.
- Upcoming appointment information.

### Screen VET-04 – Consultation Workspace

Create a professional veterinary consultation screen.

Sections:
- Pet information.
- Owner information.
- Consultation date.
- Reason for visit.
- Clinical observations.
- Recorded symptoms.
- Diagnosis.
- Treatment plan.
- Veterinary notes.

### Screen VET-05 – Add Medical Record

Fields:
- Select pet.
- Consultation date.
- Clinical findings.
- Diagnosis.
- Treatment information.
- Prescriptions when applicable.
- Additional clinical notes.
- Supporting attachments.

Include Save Record and Cancel buttons.

### Screen VET-06 – Medical Record History

Include:
- Pet selector.
- Medical record timeline.
- Previous consultations.
- Diagnosis history.
- Treatment records.
- Attending veterinarian.
- View Details.

### Screen VET-07 – Medical Record Details

Include:
- Complete consultation record.
- Pet information.
- Owner information.
- Veterinary clinic.
- Attending veterinarian.
- Clinical findings.
- Diagnosis.
- Treatment.
- Prescriptions.
- Supporting files.

### Screen VET-08 – Vaccination Management

Include:
- Vaccination records table.
- Pet name.
- Vaccine name.
- Administration date.
- Next scheduled date.
- Vaccination status.
- Actions.

### Screen VET-09 – Add Vaccination Record

Fields:
- Select pet.
- Vaccine name.
- Administration date.
- Next scheduled date when applicable.
- Administering veterinarian.
- Clinic information.
- Additional notes.
- Supporting attachment.

### Screen VET-10 – Vaccination Record Details

Include:
- Pet information.
- Vaccine information.
- Administration details.
- Next vaccination date.
- Recorded by.
- Supporting documentation.

### Screen VET-11 – Consultation History

Include:
- Completed consultation list.
- Pet name.
- Owner.
- Consultation date.
- Diagnosis.
- Record status.
- View Details.

### Screen VET-12 – Veterinarian Profile

Include:
- Profile photograph.
- Full name.
- Professional information.
- Contact details.
- Assigned clinic.
- Account settings.

---

# 11. CLINIC STAFF INTERFACE

The Clinic Staff interface must be simpler and focused on assigned operational responsibilities.

Clinic Staff must only access functions authorized by the Clinic Administrator.

### Screen CS-01 – Clinic Staff Dashboard

Include:
- Welcome message.
- Assigned clinic.
- Assigned tasks.
- Upcoming appointments.
- Relevant notifications.
- Quick access to permitted functions.

### Screen CS-02 – Assigned Tasks

Include:
- Task list.
- Task description.
- Priority.
- Due date.
- Task status.
- Update Status action.

### Screen CS-03 – Appointment Assistance

Include:
- Appointment schedule.
- Pet and owner information as permitted.
- Appointment status.
- Operational notes.
- View Details.

### Screen CS-04 – Pet Information Access

Include:
- Pet search.
- Basic pet information.
- Owner information.
- Relevant records according to permissions.

### Screen CS-05 – Staff Notifications

Include:
- Assigned task alerts.
- Appointment notifications.
- Clinic updates.
- Read/unread states.

### Screen CS-06 – Staff Profile and Settings

Include:
- Staff profile.
- Contact information.
- Assigned role.
- Account settings.
- Change Password.
- Logout.

---

# PART C: SYSTEM ADMINISTRATOR INTERFACE

# 12. SYSTEM ADMINISTRATOR DASHBOARD

The System Administrator manages the entire VetLink platform.

The System Administrator is NOT responsible for the everyday operations of individual veterinary clinics.

This interface must focus on multi-clinic registration, account management, platform monitoring, access management, and system-wide reporting.

### Screen SA-01 – System Administrator Dashboard

Statistics cards:
- Total Registered Clinics.
- Pending Clinic Applications.
- Approved Clinics.
- Suspended Clinics.
- Total Platform Users.
- Total Registered Pet Owners.

Dashboard sections:
- Clinic registration overview.
- Clinic approval requests.
- Platform activity.
- User statistics.
- Recent administrative activities.
- Platform status overview.
- Registration trends.

### Screen SA-02 – Clinic Directory

Create a complete registered clinic table.

Columns:
- Clinic name.
- Clinic location.
- Registration date.
- Clinic Administrator.
- Approval status.
- Account status.
- View Details.

Include:
- Search.
- Filters.
- Sorting.
- Pagination.

### Screen SA-03 – Clinic Registration Requests

Include:
- Pending clinic applications.
- Clinic name.
- Applicant.
- Contact information.
- Submission date.
- Application status.
- Review Application action.

### Screen SA-04 – Clinic Application Review

Include:
- Clinic information.
- Applicant information.
- Submitted documents.
- Contact information.
- Clinic location.
- Application history.
- Approve.
- Reject.
- Request Additional Information.

### Screen SA-05 – Clinic Approval Confirmation

Include:
- Clinic application summary.
- Approval confirmation.
- Account activation information.
- Confirm Approval button.

### Screen SA-06 – Clinic Account Management

Include:
- Registered clinic details.
- Account status.
- Assigned Clinic Administrator.
- Activation/deactivation controls.
- Suspension controls.
- Account history.

### Screen SA-07 – Clinic Details

Display:
- Clinic information.
- Clinic Administrator.
- Registered personnel.
- Registered pets.
- Appointment statistics.
- Registration information.
- Account status.
- Administrative actions.

### Screen SA-08 – Platform User Management

Create a complete user directory.

Columns:
- User name.
- Email.
- User category.
- Associated clinic when applicable.
- Registration date.
- Account status.
- View Details.

Include user search and filtering.

### Screen SA-09 – System User Details

Include:
- User profile.
- Assigned role.
- Associated clinic.
- Account status.
- Account creation date.
- Account activity.
- Administrative actions.

### Screen SA-10 – Role and Access Management

Include:
- User role directory.
- Role descriptions.
- Permission categories.
- Access configuration.
- Role assignment controls.

Ensure that system-wide privileges are never automatically granted to clinic personnel.

### Screen SA-11 – Platform Monitoring

Include:
- Overall platform activity.
- Registered clinic activity.
- User activity summaries.
- Application status.
- Recent system events.
- Monitoring indicators.

Use sample visualization data only. Do not present fictional server metrics as real-time integrations.

### Screen SA-12 – System Reports and Analytics

Include:
- Clinic registration reports.
- Platform user reports.
- Pet owner registration statistics.
- Appointment activity summaries.
- Clinic activity comparisons.
- Date filters.
- Export controls.

### Screen SA-13 – Administrative Audit Logs

Include:
- Activity history.
- Administrator name.
- Action performed.
- Affected account or clinic.
- Date and time.
- Action category.
- Search and filtering.

### Screen SA-14 – System Notifications

Include:
- Clinic registration updates.
- Account status changes.
- Platform announcements.
- Administrative alerts.
- Read/unread states.

### Screen SA-15 – System Settings

Include:
- Platform configuration.
- Account preferences.
- Security settings.
- Notification preferences.
- General system information.

### Screen SA-16 – System Administrator Profile

Include:
- Profile photograph.
- Full name.
- Email.
- Account information.
- Security settings.
- Change Password.
- Logout.

---

# 13. SHARED REUSABLE COMPONENT LIBRARY

Create a professional component library for the entire VetLink web application.

All components must be reusable and follow the established design system.

### Navigation components

- Sidebar.
- Sidebar navigation item.
- Expandable navigation group.
- Top header.
- Breadcrumb.
- User profile menu.
- Notification dropdown.

### Buttons

- Primary.
- Secondary.
- Outline.
- Destructive.
- Icon.
- Disabled.
- Loading.

### Tables

- Standard data table.
- Sortable columns.
- Searchable table.
- Pagination.
- Row actions.
- Empty state.
- Loading state.

### Forms

- Text input.
- Password input.
- Dropdown.
- Search input.
- Date picker.
- Time picker.
- Text area.
- File upload.
- Checkbox.
- Radio group.
- Multi-select.

### Cards

- Statistics card.
- Appointment card.
- Pet information card.
- Clinic information card.
- User profile card.
- Activity card.
- Notification card.

### Status badges

- Pending.
- Confirmed.
- Completed.
- Cancelled.
- Rejected.
- Approved.
- Suspended.
- Active.
- Inactive.

### Modals and feedback

- Confirmation dialog.
- Delete confirmation.
- Approval confirmation.
- Rejection confirmation.
- Error dialog.
- Success notification.
- Warning notification.
- Loading state.
- Empty state.

Create component variants and maintain consistent spacing, typography, borders, and colors.

---

# 14. ROLE-BASED ACCESS CONTROL

The design must accurately represent the responsibilities and permissions of each role.

### Clinic Administrator

- Manages assigned clinic information.
- Manages clinic personnel accounts.
- Manages clinic services.
- Views clinic reports.
- Manages authorized clinic records.

### Appointment Manager / Receptionist

- Manages appointments.
- Registers pet owners.
- Assists with pet registration.
- Handles appointment inquiries.
- Accesses relevant front desk information.

### Veterinarian

- Views assigned consultation schedules.
- Reviews patient information.
- Creates medical records.
- Updates diagnosis and treatment documentation.
- Manages vaccination records.

### Clinic Staff

- Accesses assigned operational functions.
- Views permitted clinic information.
- Updates assigned tasks.
- Cannot automatically access restricted medical or administrative information.

### System Administrator

- Manages platform-wide clinic registrations.
- Reviews clinic applications.
- Manages platform accounts.
- Manages roles and system access.
- Monitors platform activity.
- Manages platform settings and audit logs.

### Critical access restrictions

1. The System Administrator manages the overall VetLink platform.
2. The Clinic Administrator manages only their assigned clinic.
3. Clinic personnel must not access another clinic's private records.
4. Every clinic must have separate organizational data.
5. Clinic employees must have permissions based on their assigned roles.
6. Staff accounts must be created or invited by authorized clinic administrators.
7. Clinic registration must require System Administrator approval.
8. System Administrator accounts must not be created through public signup.

---

# 15. PROTOTYPE AND INTERACTION REQUIREMENTS

Connect important screens using Figma Prototype.

Create the following user journeys.

### Journey A – Clinic Personnel Authentication

Login → Role-Based Dashboard → Authorized Management Pages → Logout.

### Journey B – Public Clinic Registration

Registration Landing Page → Create Administrator Account → Clinic Information → Address → Services and Hours → Document Upload → Review → Submit → Pending Approval.

### Journey C – Clinic Administrator

Login → Dashboard → Clinic Profile → Services → Staff Management → Staff Permissions → Reports.

### Journey D – Appointment Manager

Login → Dashboard → Appointment Requests → Review Details → Approve or Reject → Schedule.

### Journey E – Veterinarian

Login → Dashboard → Appointment List → Patient Details → Consultation → Medical Record → Vaccination Record.

### Journey F – Clinic Staff

Login → Staff Dashboard → Assigned Tasks → Update Task Status → Notifications.

### Journey G – System Administrator

Login → System Dashboard → Clinic Applications → Review Application → Approve or Reject → Clinic Directory.

### Interaction requirements

Connect:
- Navigation items.
- Buttons.
- Tabs.
- Search fields where practical.
- Form submission flows.
- Confirmation dialogs.
- Dropdowns.
- Modal actions.
- Table actions.
- Profile menus.

For backend-dependent actions, demonstrate the intended interaction through prototype screens without claiming that actual database operations have been implemented.

---

# 16. FIGMA FILE ORGANIZATION – ONE PAGE ONLY

THIS IS A STRICT AND NON-NEGOTIABLE REQUIREMENT.

Create ONLY ONE Figma page for the entire Clinic Personnel and System Administrator Web Application.

Page name:

04 – CLINIC PERSONNEL & SYSTEM ADMIN

ALL authentication screens, clinic registration screens, all five role interfaces, management pages, and reusable components MUST be placed on THIS SAME FIGMA PAGE.

DO NOT:
- Create additional Figma pages.
- Put different roles on separate pages.
- Distribute the screens across multiple pages.
- Replace previously generated designs.
- Delete existing completed frames.

Instead, organize everything using clearly labeled Figma Sections.

### Required section organization

01 – Authentication and Account Access

02 – Public Clinic Registration

03 – Clinic Administrator

04 – Appointment Manager / Receptionist

05 – Veterinarian

06 – Clinic Staff

07 – System Administrator

08 – Reusable Components and Design System

### Frame naming conventions

Use clear and consistent frame names.

Examples:

AUTH-01 Clinic Personnel Login

AUTH-02 Forgot Password

REG-01 Clinic Registration Landing Page

REG-02 Create Clinic Administrator Account

CA-01 Clinic Administrator Dashboard

AM-01 Appointment Manager Dashboard

VET-01 Veterinarian Dashboard

CS-01 Clinic Staff Dashboard

SA-01 System Administrator Dashboard

Use 1440 × 900 px desktop frames.

Arrange frames in organized rows and columns.

Ensure:
- Clear section separation.
- Consistent frame spacing.
- No overlapping screens.
- Consistent naming.
- Easy navigation within the Figma page.

If generation must continue in multiple batches, ALWAYS add new frames to the EXISTING FIGMA PAGE.

Never create another page.

Never replace previously completed work.

---

# 17. QUALITY CONTROL CHECKLIST

Before completing the project, verify all of the following:

[ ] All authentication screens have been generated.

[ ] Public clinic registration screens have been generated.

[ ] Clinic Personnel Login is included.

[ ] System Administrator Login is included.

[ ] Forgot Password and Reset Password are included.

[ ] Email verification is included.

[ ] First-time account activation is included.

[ ] Clinic Administrator dashboard and management pages are complete.

[ ] Appointment Manager dashboard and management pages are complete.

[ ] Veterinarian dashboard and medical record pages are complete.

[ ] Clinic Staff dashboard and assigned task pages are complete.

[ ] System Administrator dashboard and platform management pages are complete.

[ ] All five roles have appropriate navigation.

[ ] All main application surfaces use pure white (#FFFFFF).

[ ] Burgundy, peach, and orange are used consistently.

[ ] All tables contain realistic sample data.

[ ] All forms have proper labels and fields.

[ ] Important actions have corresponding buttons.

[ ] Role-based permissions are reflected in the interfaces.

[ ] Clinic information is separated between independent clinics.

[ ] System Administrator responsibilities are separate from Clinic Administrator responsibilities.

[ ] Reusable components are created.

[ ] Major workflows are connected through prototypes.

[ ] All screens are on ONE FIGMA PAGE.

[ ] All sections are organized and clearly labeled.

[ ] No requested screens are missing.

[ ] No screens are merely blank placeholders.

---

# 18. FINAL DESIGN EXPECTATION

Create a complete, polished, professional, high-fidelity VetLink Clinic Personnel and System Administrator WEB APPLICATION.

The application must be suitable for:

- Multi-clinic veterinary management.
- Clinic registration and approval.
- Staff account management.
- Appointment scheduling.
- Pet and owner registration.
- Veterinary consultations.
- Medical record management.
- Vaccination management.
- Clinic reporting.
- Platform-wide administration.

The final design must look like a real, professional enterprise SaaS product.

### MOST IMPORTANT REQUIREMENTS

1. WEB APPLICATION ONLY.
2. INCLUDE ALL FIVE USER ROLES.
3. INCLUDE LOGIN, SIGNUP/REGISTRATION, AND ACCOUNT RECOVERY.
4. INCLUDE PUBLIC VETERINARY CLINIC REGISTRATION.
5. INCLUDE ALL ROLE-SPECIFIC DASHBOARDS AND MANAGEMENT PAGES.
6. USE THE EXISTING VETLINK BRANDING.
7. USE PURE WHITE (#FFFFFF) FOR MAIN BACKGROUNDS.
8. USE 1440 × 900 PX DESKTOP FRAMES.
9. KEEP ALL SCREENS ON ONE FIGMA PAGE.
10. USE ROLE-BASED NAVIGATION AND PERMISSIONS.
11. MAINTAIN SEPARATE CLINIC AND PLATFORM ADMINISTRATIVE RESPONSIBILITIES.
12. CREATE REUSABLE COMPONENTS.
13. CONNECT IMPORTANT USER FLOWS THROUGH FIGMA PROTOTYPES.
14. DO NOT OMIT ANY REQUESTED SCREEN.

### GENERATION INSTRUCTIONS

Begin by creating the shared design system and authentication pages.

Then proceed with public clinic registration, followed by the five role-based interfaces in the specified order.

Generate complete, visually polished screens with realistic sample information.

Do not stop after generating only dashboards.

If generation limits prevent completing the entire application in one pass, continue in additional batches.

Each batch must:
- Use the same existing Figma page.
- Follow the same design system.
- Reuse previously created components.
- Preserve all previously completed screens.
- Continue the existing section organization.

The final result must be one complete and consistent VetLink Web Application design organized on a SINGLE FIGMA PAGE.