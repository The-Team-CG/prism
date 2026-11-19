/**
 * P.R.I.S.M UAT test cases, used by build-uat-form.gs.
 *
 * Only modules that are implemented today are listed.
 * Test case IDs: <ROLE>-<MODULE>-<NN>. Testers quote them in comments.
 */

var UAT_FORM = {
  title: "P.R.I.S.M UAT Form",
  description:
    "User acceptance testing for P.R.I.S.M.\n\n" +
    "1. Choose your user role.\n" +
    "2. Choose ONE module to test.\n" +
    "3. Rate each test case:\n" +
    "   • Passed - Working\n" +
    "   • Partially Passed - Works but needs revision (comment required)\n" +
    "   • Fail - Not working\n" +
    "   • Skipped - Di tinest (comment required)\n" +
    "4. Fill the required module comment box. Use one line per relevant case: Test Case ID - Comment.\n" +
    "5. Enter your tester details and submit. Then submit another response for your next module.\n\n" +
    "Comments are required for every module. If no case is Partially Passed or Skipped, use a case ID followed by - No revision or skipped-case comment needed.\n" +
    "Google Forms validates comment format only. Reviewers check that each Partially Passed or Skipped case has a matching comment.\n\n" +
    "One submission per module.",
  roles: [
    {
      name: "Client",
      signIn: "Client portal. Public pages need no account. Dashboard pages need the client account issued by PMCM.",
      modules: [
        {
          id: "CL-INQ",
          name: "Public Inquiry",
          setup: "Stay signed out. Open the client portal home page.",
          cases: [
            { id: "CL-INQ-01", title: "Open the inquiry form", steps: "On the home page click Start inquiry.", expected: "The inquiry form opens on step 1 (Contact Info) and the stepper shows 4 steps." },
            { id: "CL-INQ-02", title: "Required contact details", steps: "Leave Full Name blank and click Continue. Then fill Full Name, Email, Phone, Client Type and Referral Source and click Continue.", expected: "You cannot move on while a required field is blank. With all required fields filled you reach step 2 (Event Details)." },
            { id: "CL-INQ-03", title: "Event details and date rules", steps: "Try to pick a preferred date before today. Then fill Event Name, Event Type, a future Preferred Date and Expected Guests, and click Continue.", expected: "Past dates cannot be picked. With valid details you reach step 3 (Budget & Notes)." },
            { id: "CL-INQ-04", title: "Budget, priority and review", steps: "Choose a budget range and an inquiry priority, click Continue, then click Back on step 4 and return.", expected: "Step 4 shows a summary that matches what you entered. Back keeps your answers." },
            { id: "CL-INQ-05", title: "Submit the inquiry", steps: "On step 4 try to submit without ticking the accuracy box, then tick it and submit.", expected: "Submit stays disabled until the box is ticked. After submit a success screen with a reference number and Submit another inquiry appears." },
          ],
        },
        {
          id: "CL-ACC",
          name: "Sign-in and Account Access",
          setup: "Use the client account issued for UAT.",
          cases: [
            { id: "CL-ACC-01", title: "Sign in", steps: "Open Sign in, enter the client email and password, and use the eye icon to show the password before signing in.", expected: "The password can be shown and hidden. A Signed in message appears and the dashboard opens." },
            { id: "CL-ACC-02", title: "Wrong password", steps: "Sign in with the right email and a wrong password.", expected: "An error message appears and you stay on the sign-in page." },
            { id: "CL-ACC-03", title: "Wrong portal account", steps: "Sign in here with a supplier or PMCM account.", expected: "You are refused with a message that names the correct portal." },
            { id: "CL-ACC-04", title: "Protected pages", steps: "While signed out, open the /dashboard address directly. Sign in on the page that appears.", expected: "You are sent to sign in first, then returned to the dashboard after signing in." },
            { id: "CL-ACC-05", title: "Password reset request", steps: "Click Forgot password, enter your email and click Request reset.", expected: "A status message confirms the request." },
            { id: "CL-ACC-06", title: "Sign out", steps: "Sign out, then press the browser Back button.", expected: "You are signed out and the dashboard is not shown again without signing in." },
          ],
        },
        {
          id: "CL-CON",
          name: "Conforme",
          setup: "Needs a client account with a conforme issued by PMCM.",
          cases: [
            { id: "CL-CON-01", title: "View the conforme", steps: "From the dashboard click Review conforme.", expected: "The conforme text, version and status are shown. If there are several versions you can switch between them." },
            { id: "CL-CON-02", title: "Consent before acknowledging", steps: "Try Acknowledge conforme without ticking the consent box, then tick it.", expected: "The button stays disabled until the box is ticked." },
            { id: "CL-CON-03", title: "Acknowledge the conforme", steps: "Tick the consent box and click Acknowledge conforme.", expected: "Status changes to Awaiting PMCM countersignature." },
            { id: "CL-CON-04", title: "Countersigned conforme", steps: "After PMCM countersigns, reopen the conforme.", expected: "Status shows Complete." },
          ],
        },
        {
          id: "CL-DSH",
          name: "Dashboard and My Events",
          setup: "Sign in with a client account that has at least one event.",
          cases: [
            { id: "CL-DSH-01", title: "Home", steps: "Open Home.", expected: "Your next event leads with its picture, the days to go and your next step with its button. The rows below list what needs you, and your other events show as cards." },
            { id: "CL-DSH-02", title: "Event tabs", steps: "Open Events and switch between All, Upcoming, In planning, Completed and Cancelled.", expected: "Each tab shows only the events in that state." },
            { id: "CL-DSH-03", title: "Search events", steps: "Type part of an event name in the search box.", expected: "The list narrows to matching events." },
            { id: "CL-DSH-04", title: "Open an event", steps: "Click an event card.", expected: "The event workspace opens on Overview, led by a dark card with the event's cover, the countdown and your next step." },
          ],
        },
        {
          id: "CL-REQ",
          name: "New Event Request",
          setup: "Sign in as a client.",
          cases: [
            { id: "CL-REQ-01", title: "Required fields and consent", steps: "Click New request. Leave Event name blank, then fill Event name, Event date and Planning notes without ticking privacy consent.", expected: "The request cannot be submitted until the required fields are filled and consent is ticked." },
            { id: "CL-REQ-02", title: "Submit a request", steps: "Fill the required fields, tick consent and submit.", expected: "A New event request submitted message appears." },
          ],
        },
        {
          id: "CL-EVT",
          name: "Event Workspace and Change Requests",
          setup: "Open one of your events.",
          cases: [
            { id: "CL-EVT-01", title: "Workspace tabs load", steps: "Open the Overview, Details, Schedule, Guests and Progress tabs.", expected: "Each tab loads your event data without errors. Guests shows the guest count and access code." },
            { id: "CL-EVT-02", title: "Action shortcuts", steps: "Open the Actions tab and click an action item.", expected: "The matching event tab opens." },
            { id: "CL-EVT-03", title: "Submit a change request", steps: "On Overview, submit a change request with a title, area and details. Try once with the details blank.", expected: "Blank details are refused. A complete request appears in the change request list." },
            { id: "CL-EVT-04", title: "Withdraw a change request", steps: "Withdraw the open change request you created.", expected: "The request shows as withdrawn." },
            { id: "CL-EVT-05", title: "Request an ocular visit", steps: "Open the Changes tab and click Request ocular visit, with an optional note.", expected: "The request is recorded and shown." },
            { id: "CL-EVT-06", title: "Acknowledge an addendum", steps: "If PMCM issued an addendum, tick the consent box and acknowledge it.", expected: "The addendum shows as acknowledged." },
          ],
        },
        {
          id: "CL-BRF",
          name: "Briefing and Proposal",
          setup: "Open an event in planning. Proposal cases need PMCM to issue a proposal first.",
          cases: [
            { id: "CL-BRF-01", title: "Briefing validation", steps: "Open the Briefing tab and submit with guest count 0 or blank required fields.", expected: "The briefing is refused until venue, guest count (at least 1), budget range, service requirements and notes are filled." },
            { id: "CL-BRF-02", title: "Submit and resubmit the briefing", steps: "Fill the briefing and submit. Change one field and submit again.", expected: "Both submissions are saved and the latest values are shown." },
            { id: "CL-BRF-03", title: "Approve the proposal", steps: "Open the Proposal tab and click Approve.", expected: "The proposal shows as approved." },
            { id: "CL-BRF-04", title: "Request a proposal revision", steps: "Click Request revision once without a note, then with a note.", expected: "A note is required. The revision is recorded. After 3 revisions, Revision cap reached is shown." },
            { id: "CL-BRF-05", title: "Venue and styling options", steps: "Approve one venue or styling option, and request revision on another with a note.", expected: "Approval is recorded. Revision needs a note and is recorded." },
          ],
        },
        {
          id: "CL-FLR",
          name: "Floor Plan",
          setup: "Open an event and go to the Floor plan tab.",
          cases: [
            { id: "CL-FLR-01", title: "Submit a layout preference", steps: "Fill Preference title, Guest count, Seating style, Stage preference and notes, then click Save layout notes.", expected: "The preference is sent and the form locks with PMCM has your preference." },
            { id: "CL-FLR-02", title: "Resubmit after PMCM reopens", steps: "After PMCM reopens your preference, read the note and click Resubmit layout notes.", expected: "PMCM's note is shown and the updated preference is sent." },
            { id: "CL-FLR-03", title: "Official layout is read-only", steps: "Click View official floorplan and try to move or edit items.", expected: "The official layout opens but cannot be edited by the client." },
            { id: "CL-FLR-04", title: "Review an official layout", steps: "When a layout is in review, add an annotation to an item, then Approve or Request revision with a comment.", expected: "Annotations are saved. Approval locks the layout. Revision needs a comment." },
            { id: "CL-FLR-05", title: "Shared floorplans", steps: "Open Shared floorplans from the menu and open a submitted or approved version.", expected: "Shared layouts are listed per event and open in a read-only viewer." },
          ],
        },
        {
          id: "CL-FIL",
          name: "Files and Documents",
          setup: "Sign in with a client account whose event has files PMCM asked for. Use small test files.",
          cases: [
            { id: "CL-FIL-01", title: "Start page", steps: "Open Files.", expected: "Each event shows as a card with its picture, date and a bar of how many requested files are in. Opening one shows that event's library." },
            { id: "CL-FIL-02", title: "Send a needed file", steps: "In an event's library, drop a small PDF on an item under Needed from you.", expected: "The file uploads and shows against that item, waiting for PMCM review." },
            { id: "CL-FIL-03", title: "Search, filter and preview", steps: "Search for a file by name, try the filter buttons, then open a PDF or image.", expected: "The table narrows to matches and each filter shows its count. The file opens in a preview panel with its details, status and earlier versions." },
            { id: "CL-FIL-04", title: "Download all", steps: "Click Download all for the event.", expected: "A ZIP downloads with a folder per category." },
            { id: "CL-FIL-05", title: "Use a file from another event", steps: "On a needed item, choose Use a file from another event and pick a file.", expected: "A copy is sent for that item. An expired file cannot be reused." },
            { id: "CL-FIL-06", title: "PMCM's decision", steps: "Ask PMCM to reject one file you sent with a reason, then open it.", expected: "The file shows the rejection and PMCM's reason, and you received a notice about it." },
          ],
        },
        {
          id: "CL-BIL",
          name: "Billing",
          setup: "Sign in with a client account whose event has a sent billing statement. Use test amounts only.",
          cases: [
            { id: "CL-BIL-01", title: "All events", steps: "Open Billing & Payments.", expected: "What is overdue and due in the next two weeks comes first, then each event's payments as a progress bar and every payment on a timeline with its state." },
            { id: "CL-BIL-02", title: "How to pay", steps: "Open an event's billing page and click How to pay.", expected: "The amount to send and the reference to write are shown with copy buttons, with a tab for each account PMCM turned on and its QR to save." },
            { id: "CL-BIL-03", title: "Tell PMCM you paid", steps: "Click Tell PMCM you paid, enter the amount and date, attach proof and send.", expected: "The payment shows as Being checked until PMCM verifies it. If PMCM does not accept it, PMCM's reason is shown." },
            { id: "CL-BIL-04", title: "Billing is read-only", steps: "Look for any way to edit a payment or amount.", expected: "There are no controls to change payments. Disputes show status and amount only." },
          ],
        },
        {
          id: "CL-MSG",
          name: "Messages",
          setup: "Sign in with a client account that has an event where PMCM started a conversation.",
          cases: [
            { id: "CL-MSG-01", title: "Inbox across events", steps: "Open Messages and search for a word from a message.", expected: "Conversations from all your events are listed with their event name. Search finds subjects, event names and message text." },
            { id: "CL-MSG-02", title: "Send a message", steps: "Open a conversation, check Send with an empty box, then type a message and send it.", expected: "Send is disabled while empty. The message appears in the conversation." },
            { id: "CL-MSG-03", title: "Attach a file", steps: "Attach a small file with Upload from device or Choose from Files, then send.", expected: "The file is attached to the message and opens from the conversation." },
            { id: "CL-MSG-04", title: "Earlier messages", steps: "In a long conversation click Load earlier messages.", expected: "Earlier messages load above the newest ones." },
          ],
        },
        {
          id: "CL-CAL",
          name: "Calendar and Approvals",
          setup: "Sign in with a client account that has at least one event.",
          cases: [
            { id: "CL-CAL-01", title: "Calendar views", steps: "Open Calendar and switch between Month, Week, Day and Agenda.", expected: "Today is highlighted. Each entry names what is due and its event, and payments are coloured paid, late or still due." },
            { id: "CL-CAL-02", title: "Entry details", steps: "Click an entry on the calendar.", expected: "A side panel shows the event's picture, a countdown, the event facts and a button to where it is handled." },
            { id: "CL-CAL-03", title: "Approvals overview", steps: "Open Approvals.", expected: "Proposal, Contracts, Quotations, Layouts and Final Confirmation show their current status." },
          ],
        },
        {
          id: "CL-CLO",
          name: "Event Closeout",
          setup: "Needs an event that PMCM has marked as wrapped up.",
          cases: [
            { id: "CL-CLO-01", title: "Acknowledge wrap-up and deliverables", steps: "Open the Summary tab and acknowledge the wrap-up and each deliverable.", expected: "Each item shows as acknowledged." },
            { id: "CL-CLO-02", title: "Rating and feedback", steps: "Give a rating and feedback.", expected: "Your rating and feedback are saved." },
            { id: "CL-CLO-03", title: "Testimonial consent", steps: "Add a testimonial with consent, then withdraw the consent.", expected: "The testimonial is saved, then shows consent withdrawn." },
            { id: "CL-CLO-04", title: "Archived event is read-only", steps: "Open an archived event.", expected: "It opens on Summary and nothing can be changed." },
          ],
        },
        {
          id: "CL-SEC",
          name: "Account and Security",
          setup: "Sign in with the client UAT account. Case 04 needs an authenticator app on your phone. Use a disposable test account for case 06, because it changes the sign-in email.",
          cases: [
            { id: "CL-SEC-01", title: "Account at a glance", steps: "Open the account menu and choose Account.", expected: "Your name, email, organisation and role head the page. Each setting is a row with its current value, and a row opens its task in a side panel." },
            { id: "CL-SEC-02", title: "Change your name", steps: "Open Name, change it and click Save.", expected: "The new name shows on the row and in the account menu." },
            { id: "CL-SEC-03", title: "Change your password", steps: "Open Password and enter a wrong current password. Then enter the right one and a new password twice, and click Change and sign out.", expected: "The wrong password is refused and you stay signed in. With the right one you are signed out and can sign in with the new password." },
            { id: "CL-SEC-04", title: "Two-step sign-in", steps: "Open Two-step sign-in, click Turn on, confirm your password, scan the QR code with your authenticator app and enter its code. Sign out and sign in again.", expected: "It turns on only after a correct code. Sign-in then asks for the six-digit code after the password. Turn off, with your password, switches it off." },
            { id: "CL-SEC-05", title: "Devices", steps: "Sign in on a second browser. On the first, open Devices and sign the other device out.", expected: "Devices lists both browsers with when each was last active. The signed-out browser must sign in again." },
            { id: "CL-SEC-06", title: "Change sign-in email", steps: "Open Email, enter a new address and your password, and click Send confirmation link. Open the link from the new inbox.", expected: "The Email row shows the change waiting until the link is opened. Then you are signed out, sign in with the new email, and your events are still there." },
            { id: "CL-SEC-07", title: "Recent sign-ins", steps: "Open the sign-ins row.", expected: "Your recent sign-ins are listed with the browser and whether each worked." },
          ],
        },
        {
          id: "CL-NOT",
          name: "Notifications",
          setup: "Sign in with a client account that has notices.",
          cases: [
            { id: "CL-NOT-01", title: "Notice list", steps: "Open Notifications.", expected: "Notices that ask you to acknowledge come first with their deadline, then every notice by day with its event and an unread dot. The navigation shows the unread count." },
            { id: "CL-NOT-02", title: "Open and acknowledge", steps: "Click a notice. Then click Acknowledge receipt on one that asks for it.", expected: "The notice opens the item it is about and is marked read. The acknowledged notice shows Receipt acknowledged." },
            { id: "CL-NOT-03", title: "Mark all read and settings", steps: "Click Mark all read, then open Notification settings.", expected: "Every notice is read and the unread count clears. Settings show email always on and Viber on or off." },
          ],
        },
        {
          id: "CL-PRV",
          name: "Privacy",
          setup: "Sign in with a disposable client test account. Never send a deletion request for real data.",
          cases: [
            { id: "CL-PRV-01", title: "Your requests", steps: "Open Privacy from the account menu.", expected: "Your requests are listed first, each with its step (Sent, Identity check, In progress, Done) and due date, together with the privacy notice you accepted and when." },
            { id: "CL-PRV-02", title: "New request", steps: "Click New request, choose Get a copy of my data, add details, and confirm with a wrong password, then with your password.", expected: "The wrong password is refused without signing you out. The request is sent with its identity check already done." },
            { id: "CL-PRV-03", title: "Withdraw a request", steps: "Open a request PMCM has not reviewed yet and click Cancel request.", expected: "The request shows as Cancelled." },
            { id: "CL-PRV-04", title: "Download my data now", steps: "Click Download my data now and confirm with your password.", expected: "A JSON file of your account, inquiries, events and billing downloads, and a finished request appears in your list." },
          ],
        },
      ],
    },
    {
      name: "Supplier",
      signIn: "Supplier portal. Apply and Status need no account. Dashboard pages need an approved supplier account.",
      modules: [
        {
          id: "SU-APP",
          name: "Supplier Application",
          setup: "Stay signed out. Open the supplier portal and go to Apply.",
          cases: [
            { id: "SU-APP-01", title: "Company information", steps: "Leave Company Name blank and click Continue, then fill Company Name, Contact Person and Email.", expected: "You cannot continue with a blank required field. With them filled you reach Services & Portfolio." },
            { id: "SU-APP-02", title: "Services and portfolio", steps: "Open the Service Category list and pick a category, then continue.", expected: "Categories load from the system and you reach Certifications." },
            { id: "SU-APP-03", title: "Portfolio link check", steps: "Type an invalid Portfolio URL such as abc, then a valid https link.", expected: "The invalid link is refused and the valid link is accepted." },
            { id: "SU-APP-04", title: "Submit the application", steps: "On Review & Submit, try Submit without the privacy consent, then tick it and submit.", expected: "Submit needs consent. Application submitted is shown with a reference number." },
            { id: "SU-APP-05", title: "Check application status", steps: "Open Status and enter the reference and email. Then try a wrong email.", expected: "The correct pair shows the application status. A wrong pair shows a could not find error." },
          ],
        },
        {
          id: "SU-ACC",
          name: "Sign-in and Account Access",
          setup: "Use the approved supplier account issued for UAT.",
          cases: [
            { id: "SU-ACC-01", title: "Sign in", steps: "Sign in with the supplier email and password.", expected: "The supplier dashboard opens." },
            { id: "SU-ACC-02", title: "Wrong password", steps: "Sign in with a wrong password.", expected: "A red error appears and you stay on sign-in." },
            { id: "SU-ACC-03", title: "Wrong portal account", steps: "Sign in with a client or PMCM account.", expected: "You are refused with a wrong-portal message." },
            { id: "SU-ACC-04", title: "Request PMCM approval", steps: "Expand Need supplier access?, try sending without consent, then tick consent and click Request PMCM approval.", expected: "Consent is required. A confirmation notice appears." },
            { id: "SU-ACC-05", title: "Password reset request", steps: "Expand Need supplier access?, click Forgot password?, enter your email and click Request reset.", expected: "A status message confirms the request." },
            { id: "SU-ACC-06", title: "Sign out", steps: "Click Sign out.", expected: "You return to sign-in and the dashboard needs a new sign-in." },
          ],
        },
        {
          id: "SU-DSH",
          name: "Today and Calendar",
          setup: "Sign in as a supplier with at least one quote request or booking.",
          cases: [
            { id: "SU-DSH-01", title: "Today", steps: "Open Today.", expected: "Each booking and quote request is one row with what to do next, how long is left or when to arrive, and its action button." },
            { id: "SU-DSH-02", title: "Sidebar counts", steps: "Compare the sidebar badges with the Requests & quotes and Bookings pages.", expected: "Badge counts match the pages." },
            { id: "SU-DSH-03", title: "Calendar", steps: "Open Calendar, switch between Month, Week, Day and Agenda, and click an entry.", expected: "Quote deadlines, event days and payouts are shown. An entry opens a side panel with its details and a button to where it is handled." },
          ],
        },
        {
          id: "SU-QUO",
          name: "Quote Requests and Quotations",
          setup: "Needs an open quote request from PMCM.",
          cases: [
            { id: "SU-QUO-01", title: "Submit a quote", steps: "Open Requests. Enter amount 0 and submit, then enter a valid amount, payment terms and inclusions and click Submit quote.", expected: "Amount 0 is refused. The valid quote is saved and the card shows the amount and status." },
            { id: "SU-QUO-02", title: "Revise a quote", steps: "Change the amount and click Save revision.", expected: "The revision number goes up and the new amount is shown." },
            { id: "SU-QUO-03", title: "Closed or selected request", steps: "Open a request that is closed, locked or already selected.", expected: "The form is read-only and the reason is shown." },
            { id: "SU-QUO-04", title: "Quotation history", steps: "Open Quotations.", expected: "Your quotes are listed with amount, revision, dates, payment terms and inclusions." },
            { id: "SU-QUO-05", title: "No access to other bids", steps: "Look through Requests and Quotations for other suppliers' quotes.", expected: "Only your own quotes are visible." },
          ],
        },
        {
          id: "SU-BKG",
          name: "Bookings, Contracts and Event Day",
          setup: "Needs a booking where PMCM selected your quote.",
          cases: [
            { id: "SU-BKG-01", title: "Confirm assignment", steps: "Open Bookings and click Confirm assignment.", expected: "The button changes to Assignment confirmed." },
            { id: "SU-BKG-02", title: "Confirm readiness", steps: "Enter readiness notes and click Confirm readiness.", expected: "Readiness shows as confirmed on the progress tracker." },
            { id: "SU-BKG-03", title: "Upload signed contract", steps: "Try uploading a JPG, then upload a PDF or DOCX contract.", expected: "Only PDF or DOCX is accepted. The upload is listed with version, file name and review status, and can be downloaded." },
            { id: "SU-BKG-04", title: "Schedule acknowledgment", steps: "When PMCM publishes a schedule, click Acknowledge. On another, try Request change without a reason, then with a reason.", expected: "Acknowledgment is recorded. A change request needs a reason." },
            { id: "SU-BKG-05", title: "Creative tasks", steps: "On a creative task, save a progress note, then submit a deliverable with a note or file.", expected: "Progress and the deliverable are saved. PMCM's review note appears when given." },
            { id: "SU-BKG-06", title: "Event-day status", steps: "Before confirming assignment and readiness, check the event-day buttons. After both, set Arrived, then Set up and ready, then Done and leaving.", expected: "Buttons are disabled until both are confirmed. Each status is recorded. A Late arrival warning appears after the planned ingress time." },
          ],
        },
        {
          id: "SU-FIL",
          name: "Files, Payments and Profile",
          setup: "Sign in as a supplier with a booking. Use small test files.",
          cases: [
            { id: "SU-FIL-01", title: "Files", steps: "Open Files.", expected: "What PMCM still needs from you comes first, then every booking document, contract version and certification with its review state and any expiry. A file opens in a preview." },
            { id: "SU-FIL-02", title: "Send a requested file", steps: "Drop a small PDF on an item PMCM needs.", expected: "The file is sent and shows as waiting for PMCM review." },
            { id: "SU-FIL-03", title: "Payments", steps: "Open Payments.", expected: "What PMCM has paid, the next payment and what is still to come are shown first, then each booking's payouts on a bar and a timeline. Nothing is editable." },
            { id: "SU-FIL-04", title: "Confirm a payout", steps: "On a payout PMCM sent, click I received this payment, then send your official receipt.", expected: "The payout shows as confirmed and PMCM can see your receipt." },
            { id: "SU-FIL-05", title: "Profile", steps: "Open Services & profile.", expected: "Your supplier details are shown read-only with a privacy notice." },
          ],
        },
        {
          id: "SU-MSG",
          name: "Messages",
          setup: "Needs a booking on an event where PMCM started a conversation with you.",
          cases: [
            { id: "SU-MSG-01", title: "Inbox", steps: "Open Messages.", expected: "Conversations from your bookings are listed with their event name. People are shown by name, never by email." },
            { id: "SU-MSG-02", title: "Send a message", steps: "Open a conversation, check Send with an empty box, then send a message.", expected: "Send is disabled while empty. The message appears in the conversation." },
            { id: "SU-MSG-03", title: "Earlier messages", steps: "In a long conversation click Load earlier messages.", expected: "Earlier messages load above the newest ones." },
          ],
        },
        {
          id: "SU-SEC",
          name: "Account and Security",
          setup: "Sign in with the supplier UAT account. Case 03 needs an authenticator app on your phone. Use a disposable test account for case 05.",
          cases: [
            { id: "SU-SEC-01", title: "Account at a glance", steps: "Open the account menu and choose Account.", expected: "Your name, email and role head the page, each setting is a row with its current value, and there is a link to your supplier record." },
            { id: "SU-SEC-02", title: "Change your password", steps: "Open Password, enter your current password and a new one twice, and click Change and sign out.", expected: "You are signed out and can sign in with the new password." },
            { id: "SU-SEC-03", title: "Two-step sign-in", steps: "Turn on Two-step sign-in with your authenticator app, then sign out and in again.", expected: "Sign-in asks for the six-digit code after the password." },
            { id: "SU-SEC-04", title: "Devices", steps: "Sign in on a second browser, then on the first open Devices and click Sign out everywhere else.", expected: "The other browser must sign in again; this one stays signed in." },
            { id: "SU-SEC-05", title: "Change sign-in email", steps: "Open Email, enter a new address and your password, send the link and open it from the new inbox.", expected: "After the link you sign in with the new email and your bookings and supplier record are still there." },
          ],
        },
        {
          id: "SU-NOT",
          name: "Notifications and Privacy",
          setup: "Sign in with a disposable supplier test account that has notices.",
          cases: [
            { id: "SU-NOT-01", title: "Notifications", steps: "Open Notifications and click a notice.", expected: "Notices are listed by day with their event and an unread dot. A notice opens the booking or file it is about." },
            { id: "SU-NOT-02", title: "Acknowledge", steps: "Click Acknowledge receipt on a notice that asks for it.", expected: "It shows Receipt acknowledged." },
            { id: "SU-NOT-03", title: "Privacy request", steps: "Open Privacy, click New request, choose Get a copy of my data and confirm with your password.", expected: "The request is listed with its step and due date." },
          ],
        },
      ],
    },
    {
      name: "Guest",
      signIn: "Guest portal. No account needed. Use the event access code from PMCM.",
      modules: [
        {
          id: "GU-OPN",
          name: "Open Event with Access Code",
          setup: "Get the event access code from PMCM.",
          cases: [
            { id: "GU-OPN-01", title: "Preview the event", steps: "Open the guest portal, click Open with code, type the code in lowercase and click Preview event.", expected: "The code turns uppercase and the event name, client and date are shown." },
            { id: "GU-OPN-02", title: "Wrong code", steps: "Enter a code that does not exist.", expected: "An error message is shown and no event opens." },
            { id: "GU-OPN-03", title: "Continue to the dashboard", steps: "After preview, click Continue.", expected: "The guest dashboard for that event opens." },
            { id: "GU-OPN-04", title: "Dashboard needs a code", steps: "In a private window, open the /dashboard address directly.", expected: "You are sent to the access-code page." },
            { id: "GU-OPN-05", title: "Leave event", steps: "On the dashboard click Leave event.", expected: "The pass is cleared and the access-code page opens." },
          ],
        },
        {
          id: "GU-PAS",
          name: "Event Pass and Details",
          setup: "Open an event with a valid code.",
          cases: [
            { id: "GU-PAS-01", title: "Event pass", steps: "Look at the event pass.", expected: "Event name, date and access code are shown." },
            { id: "GU-PAS-02", title: "Event details and next steps", steps: "Look at Event details and Your next steps.", expected: "Event, date, client, readiness and stage are shown. Next steps list check-in and feedback." },
          ],
        },
        {
          id: "GU-CHK",
          name: "Check-in",
          setup: "Open an event that is not archived.",
          cases: [
            { id: "GU-CHK-01", title: "Consent required", steps: "Choose check-in by name, enter your registered name and try Submit check-in without consent.", expected: "Check-in cannot be submitted without consent." },
            { id: "GU-CHK-02", title: "Check in by name", steps: "Tick consent and submit.", expected: "The button changes to Check-in submitted and check-in shows as done in next steps." },
            { id: "GU-CHK-03", title: "Check in by headcount", steps: "With another code session, choose headcount, tick consent and submit.", expected: "The headcount check-in is accepted and locked." },
          ],
        },
        {
          id: "GU-FBK",
          name: "Feedback",
          setup: "Open an event that has ended (feedback is open for 7 days after the event).",
          cases: [
            { id: "GU-FBK-01", title: "Required fields and consent", steps: "Try to submit feedback without a name or without consent.", expected: "Feedback is refused until name and consent are given." },
            { id: "GU-FBK-02", title: "File limits", steps: "Attach a photo over 10 MB, or a video longer than 60 seconds.", expected: "The file is rejected with an error message." },
            { id: "GU-FBK-03", title: "Submit feedback", steps: "Enter name, choose 1 to 5 stars, add a comment, tick consent and submit.", expected: "Feedback is accepted and shown as complete in next steps." },
          ],
        },
        {
          id: "GU-GAM",
          name: "Event Games",
          setup: "Needs a game published by PMCM and its 6-digit PIN or lobby link.",
          cases: [
            { id: "GU-GAM-01", title: "Join with PIN", steps: "Open Join game and enter 123 and then a wrong 6-digit PIN, then the real PIN.", expected: "Short PINs ask for 6 digits, wrong PINs show This game is unavailable, the real PIN joins with an alias such as Guest 1234." },
            { id: "GU-GAM-02", title: "Event lobby", steps: "Open the lobby link from PMCM.", expected: "The event branding and the list of games are shown, each with a Start button." },
            { id: "GU-GAM-03", title: "Play a round", steps: "Answer the current prompt and submit.", expected: "Your answer locks for the round and your score and standings update." },
            { id: "GU-GAM-04", title: "Resume a session", steps: "Close the tab, reopen Join game and use the resume link.", expected: "You return to the same game session with the same alias." },
          ],
        },
      ],
    },
    {
      name: "PMCM Admin",
      signIn: "Event command portal. Sign in with a pmcm-admin account. Billing corrections need a second admin account.",
      modules: [
        {
          id: "AD-ACC",
          name: "Sign-in and Account Access",
          setup: "Use the PMCM admin account issued for UAT and its authenticator app.",
          cases: [
            { id: "AD-ACC-01", title: "Sign in with two steps", steps: "Sign in with the admin email and password, then enter a wrong six-digit code, then the right one from your authenticator app.", expected: "The wrong code can be retried. The PMCM dashboard opens with the full sidebar." },
            { id: "AD-ACC-02", title: "Wrong password", steps: "Sign in with a wrong password.", expected: "An error appears and you stay on sign-in." },
            { id: "AD-ACC-03", title: "Wrong portal account", steps: "Sign in with a client or supplier account.", expected: "You are refused with a link to the correct portal." },
            { id: "AD-ACC-04", title: "Protected pages", steps: "While signed out, open /dashboard directly, then sign in.", expected: "You are sent to sign in, then back to the dashboard." },
            { id: "AD-ACC-05", title: "Password reset request", steps: "Request a password reset by email.", expected: "A status message confirms the request." },
            { id: "AD-ACC-06", title: "Account page", steps: "Open Account from the account menu.", expected: "Two-step sign-in shows On, required for PMCM staff, with no way to turn it off. Workspace settings is linked from the page." },
            { id: "AD-ACC-07", title: "Devices", steps: "Sign in on a second browser, then on the first open Devices and click Sign out everywhere else.", expected: "The other browser must sign in again; this one stays signed in." },
          ],
        },
        {
          id: "AD-INB",
          name: "Dashboard and Command Inbox",
          setup: "Sign in as admin.",
          cases: [
            { id: "AD-INB-01", title: "Command inbox", steps: "Open the dashboard, refresh the inbox and change pages.", expected: "Inbox items load, the sidebar badge matches the count and paging works." },
            { id: "AD-INB-02", title: "Selected event summary", steps: "Select an event and click Open event on the summary card.", expected: "The summary matches the event and opens its workspace." },
            { id: "AD-INB-03", title: "Account requests", steps: "Approve one pending account request and decline another.", expected: "Each request leaves the pending list with the chosen result." },
            { id: "AD-INB-04", title: "Events needing you", steps: "Open Events.", expected: "Needs you lists each event with the Inbox's own items for it, then Coming up and Done, with Archive as a tab." },
            { id: "AD-INB-05", title: "Notifications", steps: "Open Notifications and acknowledge a notice that asks for it.", expected: "Notices that need acknowledging come first, then every notice by day. The navigation shows the unread count." },
          ],
        },
        {
          id: "AD-INQ",
          name: "Inquiries and Client Onboarding",
          setup: "Submit a test inquiry from the client portal first.",
          cases: [
            { id: "AD-INQ-01", title: "Review a new inquiry", steps: "Open Inquiries and open the test inquiry.", expected: "The details match what the client submitted, with duplicate and previously-declined cues where they apply." },
            { id: "AD-INQ-02", title: "Pend and decline", steps: "Pend one inquiry. Decline another, first without a reason, then with a reason.", expected: "Pend is recorded. Decline needs a reason." },
            { id: "AD-INQ-03", title: "Merge duplicates", steps: "Merge a duplicate inquiry into its organization with a reason.", expected: "The merge needs a reason and shows in merge history." },
            { id: "AD-INQ-04", title: "Log on behalf of a client", steps: "Log an inquiry on behalf of a client, including How did you hear about us.", expected: "The inquiry is created and marked as logged by PMCM." },
            { id: "AD-INQ-05", title: "Accept and upload conforme", steps: "Accept the inquiry. Upload a non-PDF as the signed conforme, then a PDF under 10 MB.", expected: "Non-PDF files are refused. After the PDF upload the event workspace is created and the client can open their portal." },
            { id: "AD-INQ-06", title: "Conforme reminder and follow-up", steps: "Send a conforme reminder, then generate a follow-up draft and click Approve and queue for delivery.", expected: "The reminder is recorded and the draft is queued, not sent instantly." },
          ],
        },
        {
          id: "AD-CLI",
          name: "Clients",
          setup: "Sign in as admin.",
          cases: [
            { id: "AD-CLI-01", title: "Client list and details", steps: "Open Clients and open a client.", expected: "Contact, company, event and inquiry counts and balance are shown." },
            { id: "AD-CLI-02", title: "Client events", steps: "Open the client's events view and click an event.", expected: "The event workspace opens." },
            { id: "AD-CLI-03", title: "Archived event search", steps: "Search archived events by venue, event type or month.", expected: "Matching archived events are listed." },
          ],
        },
        {
          id: "AD-TSK",
          name: "Tasks and Ocular Visits",
          setup: "Needs an event with an ocular visit request.",
          cases: [
            { id: "AD-TSK-01", title: "Schedule and complete an ocular", steps: "Open Tasks, schedule an ocular visit, then mark it complete.", expected: "Status changes to scheduled, then completed." },
            { id: "AD-TSK-02", title: "Waive an ocular", steps: "Waive an ocular visit without a reason, then with a reason.", expected: "A reason is required and the waiver is recorded." },
            { id: "AD-TSK-03", title: "Action center links", steps: "Click each action-center count.", expected: "Each link opens the matching list (inquiries, approvals, quotes, payments, checks)." },
          ],
        },
        {
          id: "AD-OVR",
          name: "Event Overview, Briefing and Change Control",
          setup: "Open an event in planning.",
          cases: [
            { id: "AD-OVR-01", title: "Briefing and compliance", steps: "On Overview submit the event briefing and run planning compliance. Open the Briefing tab.", expected: "The briefing is saved and shown on the Briefing tab. Compliance results appear." },
            { id: "AD-OVR-02", title: "Scope change requests", steps: "Start review on a client change request, then approve or reject it with a reason.", expected: "The decision needs a reason and the client sees the new status." },
            { id: "AD-OVR-03", title: "Freeze scope and exceptions", steps: "Freeze scope with a reason, then create and approve a freeze exception.", expected: "Freeze needs a reason. The exception is listed and used once." },
            { id: "AD-OVR-04", title: "Cancellation or postponement", steps: "Record a postponement with a new date and deposit treatment (use a test event).", expected: "The impact review is shown and the decision is recorded." },
            { id: "AD-OVR-05", title: "Secondary contacts and access code", steps: "Grant floorplan access to an approved client account. Check the guest access code.", expected: "The contact is added. The guest access code is shown, or Pending if not yet generated." },
          ],
        },
        {
          id: "AD-FLR",
          name: "Floorplans",
          setup: "Open an event and go to Floorplans.",
          cases: [
            { id: "AD-FLR-01", title: "Create from template", steps: "Start a new draft from a saved venue template.", expected: "The draft opens with the template layout." },
            { id: "AD-FLR-02", title: "Edit and save", steps: "Add and move items in the editor and save.", expected: "Changes are kept after reopening the draft." },
            { id: "AD-FLR-03", title: "Table assignment rules", steps: "Assign more guests to a table than it holds and save.", expected: "The save is refused with a clear reason." },
            { id: "AD-FLR-04", title: "Submit and approve", steps: "Submit a draft for review, then approve it.", expected: "Submit only shows for new or needs-revision drafts. Approve only shows for drafts in review." },
            { id: "AD-FLR-05", title: "Client preference", steps: "Open a client's submitted preference and reopen it with a note.", expected: "The client's preference is shown and the client can revise it again." },
          ],
        },
        {
          id: "AD-SUP",
          name: "Event Suppliers",
          setup: "Open an event and go to Suppliers.",
          cases: [
            { id: "AD-SUP-01", title: "Request and compare quotes", steps: "Request quotes for a category, then compare received quotes and select one.", expected: "Suppliers receive the request. The selected quote is marked and others are closed." },
            { id: "AD-SUP-02", title: "Readiness board", steps: "Open the readiness board.", expected: "Each supplier's readiness is shown. A category with no selected quote shows a hard block." },
            { id: "AD-SUP-03", title: "Ingress schedule", steps: "Publish an ingress and egress schedule.", expected: "The supplier sees the schedule and can acknowledge it." },
            { id: "AD-SUP-04", title: "Contracts", steps: "Review a supplier contract upload and request a revision with a reason.", expected: "The supplier sees the revision request and reason." },
            { id: "AD-SUP-05", title: "Payables", steps: "Release a payable milestone, then reverse it.", expected: "Release and reversal are recorded and amounts update." },
            { id: "AD-SUP-06", title: "Emergency replacement", steps: "Withdraw a confirmed supplier (test event only).", expected: "A recommended replacement and draft messages are shown for PMCM to review." },
          ],
        },
        {
          id: "AD-DIR",
          name: "Supplier Directory and Applications",
          setup: "Submit a test supplier application first.",
          cases: [
            { id: "AD-DIR-01", title: "Applications inbox", steps: "Open the test application and request a proposal, schedule a meeting or decline.", expected: "The status changes and the applicant sees it on the Status page." },
            { id: "AD-DIR-02", title: "Approve an application", steps: "Approve an application.", expected: "A directory supplier is created, pending its first event." },
            { id: "AD-DIR-03", title: "Create and edit a supplier", steps: "Create a supplier, then edit its profile, tier and BNI membership.", expected: "Changes are saved and shown in the directory." },
            { id: "AD-DIR-04", title: "Filters", steps: "Filter by category, tier and rating.", expected: "The list shows only matching suppliers." },
          ],
        },
        {
          id: "AD-COR",
          name: "Coordinators and Team",
          setup: "Open an event and go to Coordinators.",
          cases: [
            { id: "AD-COR-01", title: "Assign with suggestions", steps: "Pick a role and assign a coordinator from the suggestions.", expected: "Suggestions show skill match and the coordinator is assigned." },
            { id: "AD-COR-02", title: "Same-date conflict", steps: "Assign a coordinator already booked on the same date.", expected: "The assignment is blocked and same-role alternatives are suggested." },
            { id: "AD-COR-03", title: "Event Day System Operator", steps: "Designate a coordinator as Event Day System Operator.", expected: "The designation is shown and that coordinator gets operator controls." },
            { id: "AD-COR-04", title: "Availability and reminders", steps: "Add an unavailable date for a coordinator and send an acknowledgment reminder.", expected: "The date blocks assignment and the reminder is recorded." },
            { id: "AD-COR-05", title: "Reliability history", steps: "Open a coordinator's reliability history.", expected: "Past assignments and withdrawals are listed." },
          ],
        },
        {
          id: "AD-LIV",
          name: "Live Ops and Run Sheet",
          setup: "Open an event near or on event day.",
          cases: [
            { id: "AD-LIV-01", title: "Event-day tasks", steps: "Create a task with title, owner role, priority and SLA, then update and escalate it.", expected: "The task is listed and its status changes are shown." },
            { id: "AD-LIV-02", title: "Urgent issues", steps: "Log an issue with severity and area, then update it.", expected: "The issue is listed and its changes are shown." },
            { id: "AD-LIV-03", title: "Coordinator attendance", steps: "Mark coordinators present, late and absent. Replace an absent one using suggestions.", expected: "Attendance is recorded and the replacement is assigned." },
            { id: "AD-LIV-04", title: "Schedule and handoffs", steps: "Add a day and segments, record a shift handoff and reply to an end-of-day report.", expected: "Each entry is saved and shown." },
            { id: "AD-LIV-05", title: "Run sheet", steps: "Open Run sheet and print it.", expected: "Items are in time order and the print view is readable." },
          ],
        },
        {
          id: "AD-REG",
          name: "Registration and Guests",
          setup: "Open an event and go to Registration.",
          cases: [
            { id: "AD-REG-01", title: "Registration setup", steps: "Set the registration platform type and min, max and expected guests.", expected: "The settings are saved." },
            { id: "AD-REG-02", title: "Guest roster", steps: "Import a guest roster, then search and filter it.", expected: "Guests are imported and search finds them." },
            { id: "AD-REG-03", title: "Check-in and verification", steps: "Verify and check in a guest from the roster.", expected: "The guest shows as verified and checked in." },
            { id: "AD-REG-04", title: "Walk-in and privacy settings", steps: "Set the walk-in policy open or closed with a threshold, and set guest privacy classification.", expected: "The settings are saved and apply at the registration desk." },
          ],
        },
        {
          id: "AD-GAM",
          name: "Event Games",
          setup: "Open an event and go to Games.",
          cases: [
            { id: "AD-GAM-01", title: "Create and configure", steps: "Create a game from the catalog and set its questions or options.", expected: "The draft is saved with your configuration." },
            { id: "AD-GAM-02", title: "Lobby and branding", steps: "Set the lobby logo and theme, copy the lobby URL and show the PIN.", expected: "Guests opening the URL see your branding. The PIN is shown when you choose." },
            { id: "AD-GAM-03", title: "Run the game", steps: "Publish, start, go to the next round and end the game while a guest plays.", expected: "The guest screen follows each step and the leaderboard updates." },
            { id: "AD-GAM-04", title: "Moderation and awards", steps: "Hide a guest answer and assign an award.", expected: "The hidden answer disappears from shared results and the award is recorded." },
          ],
        },
        {
          id: "AD-BIL",
          name: "Billing and Finance",
          setup: "Open an event with a billing statement. Correction approval needs a second admin account.",
          cases: [
            { id: "AD-BIL-01", title: "Record a payment", steps: "Record a payment of 0, then more than the milestone balance, then a valid amount (Bank Transfer, Cheque or GCash).", expected: "0 and over-balance amounts are refused. The valid payment updates the balance." },
            { id: "AD-BIL-02", title: "Send the statement", steps: "Send the billing statement.", expected: "The send is logged in notification activity and the client sees the statement." },
            { id: "AD-BIL-03", title: "Disputes and waivers", steps: "Record a dispute above the statement total, then a valid one, and resolve or waive it with a reason.", expected: "The over-total dispute is refused. Resolve or waive needs a reason." },
            { id: "AD-BIL-04", title: "Additional billing", steps: "Issue additional billing from an approved billing source.", expected: "The additional billing appears on the statement." },
            { id: "AD-BIL-05", title: "Correction needs a second admin", steps: "Request a correction, try to approve it with the same admin, then approve it with a second admin.", expected: "Approve is disabled for the requester. The second admin can approve." },
            { id: "AD-BIL-06", title: "Finance desk", steps: "Open Finance.", expected: "Totals for clients overdue, money to verify, what PMCM owes suppliers and open disputes come first, then a Needs you queue with filters, and charts with a table view." },
            { id: "AD-BIL-07", title: "Verify a reported payment", steps: "In the Finance queue, verify a payment a client reported.", expected: "The payment counts toward the balance and the client gets a notice." },
            { id: "AD-BIL-08", title: "Payment details", steps: "Open Payment details, add a test bank account with a QR image, turn it on and save.", expected: "The preview shows what the client will see. A billing statement can be issued only while an account is turned on." },
          ],
        },
        {
          id: "AD-CLO",
          name: "Closure and Archive",
          setup: "Open an event that has ended (use a test event).",
          cases: [
            { id: "AD-CLO-01", title: "Record end and logistics", steps: "Record the actual end time. Try logistics completion before confirming asset returns, then after.", expected: "Logistics completion needs asset returns confirmed first and is then recorded." },
            { id: "AD-CLO-02", title: "Wrap-up and close gates", steps: "Complete the wrap-up and review the close gates.", expected: "Must-fix and advisory gates are shown with their status." },
            { id: "AD-CLO-03", title: "Archive rules", steps: "Try to archive with a failing gate and no reason, then give an override reason.", expected: "Archive is blocked without a reason and allowed with one." },
            { id: "AD-CLO-04", title: "Reviews, testimonials and feedback", steps: "Add a supplier review, approve a client testimonial and approve or hide a guest feedback item.", expected: "Each decision is saved. Hidden feedback is not shown publicly." },
            { id: "AD-CLO-05", title: "Compare archived events", steps: "Select 2 to 4 archived events and compare them.", expected: "A side-by-side comparison is shown. Fewer than 2 or more than 4 cannot be compared." },
          ],
        },
        {
          id: "AD-MSG",
          name: "Messages",
          setup: "Sign in as admin. Use an event with a client and a booked supplier.",
          cases: [
            { id: "AD-MSG-01", title: "Start a conversation", steps: "Open Messages, click New conversation, choose the event and the client, add a topic and send a message.", expected: "The conversation is created and the client can see the message." },
            { id: "AD-MSG-02", title: "Members and closing", steps: "Add the supplier to the conversation, then close it.", expected: "The supplier gets a notice and sees earlier messages. A closed conversation takes no new messages and moves to Closed." },
            { id: "AD-MSG-03", title: "Seen by", steps: "After the client opens your message, look under it.", expected: "Seen by shows the client." },
          ],
        },
        {
          id: "AD-FIL",
          name: "Files and Requirements",
          setup: "Sign in as admin. Use an event where a client or supplier has sent files.",
          cases: [
            { id: "AD-FIL-01", title: "Requirements matrix", steps: "Add a requirement and set owner role, visibility, required flag and due date.", expected: "The requirement is saved and only the chosen roles can see it." },
            { id: "AD-FIL-02", title: "Review queue", steps: "Open Files, open the event, approve one waiting file and reject another with a reason.", expected: "The sender is told the outcome and, on a rejection, the reason. Approve several at once works on a selection." },
            { id: "AD-FIL-03", title: "Event cover", steps: "Open an image in the event's files and choose Use as event cover.", expected: "The image becomes the cover on the event's cards and overview, for the client too." },
          ],
        },
        {
          id: "AD-AUD",
          name: "Audit Trail and Decision Log",
          setup: "Sign in as admin after doing a few actions.",
          cases: [
            { id: "AD-AUD-01", title: "Audit trail filters", steps: "Open Audit and filter by event, severity and user.", expected: "Your recent actions appear and filters narrow the list." },
            { id: "AD-AUD-02", title: "Decision log", steps: "Open an event's Decision log tab.", expected: "Overrides, approvals and scope decisions are listed with their reasons." },
            { id: "AD-AUD-03", title: "Reset two-factor", steps: "In the accounts list, choose Reset two-factor for a test account that has it on, and confirm.", expected: "The account's two-step sign-in is off and its open sessions end." },
          ],
        },
        {
          id: "AD-PRV",
          name: "Privacy Console",
          setup: "Needs test privacy requests, including one a client filed. Use test data only.",
          cases: [
            { id: "AD-PRV-01", title: "Queue and filters", steps: "Open Privacy. On the Queue tab filter by type, status and owner, and assign a request to yourself.", expected: "The queue filters correctly and shows due dates. You become the owner." },
            { id: "AD-PRV-02", title: "Approve, reject and execute", steps: "Approve and execute an access/export request on test data. Reject another.", expected: "Execution returns the subject's data bundle. Rejection is recorded." },
            { id: "AD-PRV-03", title: "Legal hold", steps: "On Legal holds, place a hold, then release it with a reason.", expected: "While on hold, related deletion is blocked. The release is recorded." },
            { id: "AD-PRV-04", title: "Self-service request", steps: "Open a request a client filed themselves.", expected: "It is marked self-service and shows Identity confirmed with the account password." },
          ],
        },
        {
          id: "AD-SET",
          name: "Workspace Settings",
          setup: "Sign in as admin.",
          cases: [
            { id: "AD-SET-01", title: "Client event-day view switch", steps: "Open Workspace settings and turn the Client event-day view switch on and off.", expected: "A saving state appears and the setting stays after reload." },
          ],
        },
      ],
    },
    {
      name: "Coordinator",
      signIn: "Coordinator portal. Sign in with a coordinator account assigned to the test event.",
      modules: [
        {
          id: "CO-ACC",
          name: "Sign-in and Portal Scope",
          setup: "Use the coordinator account issued for UAT.",
          cases: [
            { id: "CO-ACC-01", title: "Sign in", steps: "Sign in with the coordinator email and password.", expected: "The Coordinator Portal opens, not the PMCM command portal." },
            { id: "CO-ACC-02", title: "PMCM areas are closed", steps: "Type PMCM addresses such as /dashboard/finance or /dashboard/audit.", expected: "Only the Coordinator Portal is shown. No finance, audit, inquiry or supplier data is visible." },
            { id: "CO-ACC-03", title: "Role notice", steps: "Read the boundary notice.", expected: "It says coordinators only see data for their role." },
            { id: "CO-ACC-04", title: "Account", steps: "Open Account from the account menu.", expected: "Your name, email, password, two-step sign-in and devices are shown. Two-step sign-in can be turned on with an authenticator app." },
            { id: "CO-ACC-05", title: "Notifications", steps: "Open Notifications and click a notice.", expected: "The notice opens your shift or run sheet, not a PMCM event page." },
          ],
        },
        {
          id: "CO-EVT",
          name: "Event Switcher and Assignment",
          setup: "Needs at least one assignment from PMCM.",
          cases: [
            { id: "CO-EVT-01", title: "Assigned events only", steps: "Open the event switcher.", expected: "Only events you are assigned to are listed, including past ones." },
            { id: "CO-EVT-02", title: "Acknowledge or decline", steps: "Acknowledge a new assignment. On another test assignment, decline or withdraw.", expected: "Each action is recorded and appears in assignment history." },
            { id: "CO-EVT-03", title: "Archived events", steps: "Switch to an archived event.", expected: "A read-only banner is shown and all forms are disabled." },
          ],
        },
        {
          id: "CO-DAY",
          name: "Event Day Work",
          setup: "Select a current event you are assigned to.",
          cases: [
            { id: "CO-DAY-01", title: "Mark arrival", steps: "Mark your arrival.", expected: "Your attendance shows as arrived." },
            { id: "CO-DAY-02", title: "Assigned to you", steps: "Update the status of a task in your queue.", expected: "The new status is saved." },
            { id: "CO-DAY-03", title: "Request reassignment", steps: "Request reassignment of a task with a reason and a new role or coordinator.", expected: "The request is sent to the operator or PMCM." },
            { id: "CO-DAY-04", title: "Log task and urgent issue", steps: "Log an event-day task with priority and due time, and an urgent issue with severity and area.", expected: "Both are recorded and PMCM can see them in Live ops." },
            { id: "CO-DAY-05", title: "Timeline and briefing", steps: "Open the timeline and briefing.", expected: "The critical timeline and floor and stage briefing are shown, or a message if PMCM has not submitted the briefing." },
          ],
        },
        {
          id: "CO-OPR",
          name: "Event Day System Operator",
          setup: "Sign in as the coordinator PMCM designated as operator. Some cases need a second, non-operator coordinator.",
          cases: [
            { id: "CO-OPR-01", title: "Delegated attendance", steps: "Mark another coordinator absent with Confirm absent.", expected: "Their attendance is updated." },
            { id: "CO-OPR-02", title: "Reassignment decisions", steps: "Approve one reassignment request and reject another.", expected: "Both decisions are recorded and the task owner updates." },
            { id: "CO-OPR-03", title: "Edit the schedule", steps: "Add a day and a segment.", expected: "The schedule is updated." },
            { id: "CO-OPR-04", title: "Non-operator cannot edit", steps: "Sign in as a non-operator coordinator and open the schedule.", expected: "A message says only the designated operator can edit the schedule." },
          ],
        },
        {
          id: "CO-SUP",
          name: "Supplier Setup Checks",
          setup: "Sign in as the operator or an Ingress and Egress coordinator.",
          cases: [
            { id: "CO-SUP-01", title: "Verify setup", steps: "Verify a supplier's setup.", expected: "The setup shows as verified and PMCM sees it." },
            { id: "CO-SUP-02", title: "Dispute setup", steps: "Dispute another supplier's setup with a note.", expected: "The dispute is recorded and PMCM sees it." },
          ],
        },
        {
          id: "CO-REG",
          name: "Registration Desk",
          setup: "Sign in as a Registration Staff coordinator assigned to the event.",
          cases: [
            { id: "CO-REG-01", title: "Search the roster", steps: "Search the guest roster by name.", expected: "Matching guests are listed with limited details." },
            { id: "CO-REG-02", title: "Check in a guest", steps: "Verify and check in a guest.", expected: "The guest shows as checked in." },
            { id: "CO-REG-03", title: "Register a walk-in", steps: "Register a walk-in without consent, then with consent, then verify and check them in.", expected: "Consent is required. The walk-in follows the PMCM walk-in policy and can be checked in after verification." },
            { id: "CO-REG-04", title: "Archived event", steps: "Switch to an archived event and try to check in a guest.", expected: "The roster can be read but check-in is refused." },
          ],
        },
      ],
    },
  ],
};
