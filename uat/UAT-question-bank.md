# P.R.I.S.M UAT question bank

Source: `uat-test-cases.gs`. Create one Google Form with the paste-ready `PRISM-UAT-Google-Form.gs`. See [setup instructions](README.md).

## Form flow

1. **What is your user role?** Client, Supplier, Guest, PMCM Admin, or Coordinator.
2. **What module would you test?** Only that role's modules are listed.
3. Read the setup, steps, and expected results below. Each module has one required ratings grid with one row per test case and four columns:
   - Passed - Working
   - Partially Passed - Works but needs revision (w/ comment)
   - Fail - Not Working
   - Skipped - Di tinest (w/ comment)
4. Complete the required module comment box:

   > IF YOU SELECT PARTIALLY PASSED OR SKIPPED Please may we know your suggestion or the part that need to improve STRICTLY
   >
   > Format: Test Case ID - Comment

   Use one line per Partially Passed or Skipped case. The form validates the ID and comment format; reviewers check each relevant rating has its own comment. If none apply, use a case ID from the module followed by ` - No revision or skipped-case comment needed.`
5. Enter tester name and test date at the end, then submit. **One submission per module.** Use Submit another response for your next module.

## Summary

| Role | Modules | Test cases |
| --- | ---: | ---: |
| Client | 13 | 51 |
| Supplier | 7 | 30 |
| Guest | 5 | 17 |
| PMCM Admin | 20 | 78 |
| Coordinator | 6 | 21 |
| **Total** | **51** | **197** |

## Client

Client portal. Public pages need no account. Dashboard pages need the client account issued by PMCM.

### CL-INQ · Public Inquiry

Before you start: Stay signed out. Open the client portal home page.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-INQ-01 | Open the inquiry form | On the home page click Start inquiry. | The inquiry form opens on step 1 (Contact Info) and the stepper shows 4 steps. |
| CL-INQ-02 | Required contact details | Leave Full Name blank and click Continue. Then fill Full Name, Email, Phone, Client Type and Referral Source and click Continue. | You cannot move on while a required field is blank. With all required fields filled you reach step 2 (Event Details). |
| CL-INQ-03 | Event details and date rules | Try to pick a preferred date before today. Then fill Event Name, Event Type, a future Preferred Date and Expected Guests, and click Continue. | Past dates cannot be picked. With valid details you reach step 3 (Budget & Notes). |
| CL-INQ-04 | Budget, priority and review | Choose a budget range and an inquiry priority, click Continue, then click Back on step 4 and return. | Step 4 shows a summary that matches what you entered. Back keeps your answers. |
| CL-INQ-05 | Submit the inquiry | On step 4 try to submit without ticking the accuracy box, then tick it and submit. | Submit stays disabled until the box is ticked. After submit a success screen with a reference number and Submit another inquiry appears. |

### CL-ACC · Sign-in and Account Access

Before you start: Use the client account issued for UAT.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-ACC-01 | Sign in | Open Sign in, enter the client email and password, and use the eye icon to show the password before signing in. | The password can be shown and hidden. A Signed in message appears and the dashboard opens. |
| CL-ACC-02 | Wrong password | Sign in with the right email and a wrong password. | An error message appears and you stay on the sign-in page. |
| CL-ACC-03 | Wrong portal account | Sign in here with a supplier or PMCM account. | You are refused with a message that names the correct portal. |
| CL-ACC-04 | Protected pages | While signed out, open the /dashboard address directly. Sign in on the page that appears. | You are sent to sign in first, then returned to the dashboard after signing in. |
| CL-ACC-05 | Password reset request | Click Forgot password, enter your email and click Request reset. | A status message confirms the request. |
| CL-ACC-06 | Sign out | Sign out, then press the browser Back button. | You are signed out and the dashboard is not shown again without signing in. |

### CL-CON · Conforme

Before you start: Needs a client account with a conforme issued by PMCM.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-CON-01 | View the conforme | From the dashboard click Review conforme. | The conforme text, version and status are shown. If there are several versions you can switch between them. |
| CL-CON-02 | Consent before acknowledging | Try Acknowledge conforme without ticking the consent box, then tick it. | The button stays disabled until the box is ticked. |
| CL-CON-03 | Acknowledge the conforme | Tick the consent box and click Acknowledge conforme. | Status changes to Awaiting PMCM countersignature. |
| CL-CON-04 | Countersigned conforme | After PMCM countersigns, reopen the conforme. | Status shows Complete. |

### CL-DSH · Dashboard and My Events

Before you start: Sign in with a client account that has at least one event.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-DSH-01 | Action center | Open the dashboard home. | Needs your action and Waiting on PMCM lists are shown, together with Recent updates from PMCM. |
| CL-DSH-02 | Event tabs | Open My events and switch between All, Upcoming, In planning, Completed and Cancelled. | Each tab shows only the events in that state. |
| CL-DSH-03 | Search events | Type part of an event name in the search box. | The list narrows to matching events. |
| CL-DSH-04 | Open an event | Click an event card. | The event workspace opens on the Overview tab for that event. |

### CL-REQ · New Event Request

Before you start: Sign in as a client.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-REQ-01 | Required fields and consent | Click New request. Leave Event name blank, then fill Event name, Event date and Planning notes without ticking privacy consent. | The request cannot be submitted until the required fields are filled and consent is ticked. |
| CL-REQ-02 | Submit a request | Fill the required fields, tick consent and submit. | A New event request submitted message appears. |

### CL-EVT · Event Workspace and Change Requests

Before you start: Open one of your events.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-EVT-01 | Workspace tabs load | Open the Overview, Details, Schedule, Guests and Progress tabs. | Each tab loads your event data without errors. Guests shows the guest count and access code. |
| CL-EVT-02 | Action shortcuts | Open the Actions tab and click an action item. | The matching event tab opens. |
| CL-EVT-03 | Submit a change request | On Overview, submit a change request with a title, area and details. Try once with the details blank. | Blank details are refused. A complete request appears in the change request list. |
| CL-EVT-04 | Withdraw a change request | Withdraw the open change request you created. | The request shows as withdrawn. |
| CL-EVT-05 | Request an ocular visit | Open the Changes tab and click Request ocular visit, with an optional note. | The request is recorded and shown. |
| CL-EVT-06 | Acknowledge an addendum | If PMCM issued an addendum, tick the consent box and acknowledge it. | The addendum shows as acknowledged. |

### CL-BRF · Briefing and Proposal

Before you start: Open an event in planning. Proposal cases need PMCM to issue a proposal first.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-BRF-01 | Briefing validation | Open the Briefing tab and submit with guest count 0 or blank required fields. | The briefing is refused until venue, guest count (at least 1), budget range, service requirements and notes are filled. |
| CL-BRF-02 | Submit and resubmit the briefing | Fill the briefing and submit. Change one field and submit again. | Both submissions are saved and the latest values are shown. |
| CL-BRF-03 | Approve the proposal | Open the Proposal tab and click Approve. | The proposal shows as approved. |
| CL-BRF-04 | Request a proposal revision | Click Request revision once without a note, then with a note. | A note is required. The revision is recorded. After 3 revisions, Revision cap reached is shown. |
| CL-BRF-05 | Venue and styling options | Approve one venue or styling option, and request revision on another with a note. | Approval is recorded. Revision needs a note and is recorded. |

### CL-FLR · Floor Plan

Before you start: Open an event and go to the Floor plan tab.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-FLR-01 | Submit a layout preference | Fill Preference title, Guest count, Seating style, Stage preference and notes, then click Save layout notes. | The preference is sent and the form locks with PMCM has your preference. |
| CL-FLR-02 | Resubmit after PMCM reopens | After PMCM reopens your preference, read the note and click Resubmit layout notes. | PMCM's note is shown and the updated preference is sent. |
| CL-FLR-03 | Official layout is read-only | Click View official floorplan and try to move or edit items. | The official layout opens but cannot be edited by the client. |
| CL-FLR-04 | Review an official layout | When a layout is in review, add an annotation to an item, then Approve or Request revision with a comment. | Annotations are saved. Approval locks the layout. Revision needs a comment. |
| CL-FLR-05 | Shared floorplans | Open Shared floorplans from the menu and open a submitted or approved version. | Shared layouts are listed per event and open in a read-only viewer. |

### CL-FIL · Files and Documents

Before you start: Select an event, then open Files.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-FIL-01 | Folder filters | Click each folder button (Contracts, Quotations, Invoices & receipts, Event layouts, Uploaded, Shared). | The list and counts change for each folder. |
| CL-FIL-02 | Upload a file | Click Upload file and choose a small PDF. | The file uploads and appears in the list. |
| CL-FIL-03 | Download a file | Click the download icon on a file. | The file downloads and opens correctly. |
| CL-FIL-04 | File requirements | Look at the File requirements checklist. | Required files are listed with their due status. |

### CL-BIL · Billing

Before you start: Select an event with a billing statement.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-BIL-01 | Statement and milestones | Open Billing. | The billing statement, payment milestones and remaining balance are shown and match PMCM's records. |
| CL-BIL-02 | Billing is read-only | Look for any way to edit a payment or amount. | There are no controls to change payments. Disputes show status and amount only. |

### CL-MSG · Messages

Before you start: Select an event where PMCM has opened a message thread.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-MSG-01 | Send a message | Open Messages. Check Send with an empty box, then type a message and send it. | Send is disabled while empty. The message appears in the conversation. |
| CL-MSG-02 | Receive and load history | Ask PMCM to reply, then reopen Messages and click Load older messages. | PMCM's reply is visible and older messages load. |

### CL-CAL · Calendar and Approvals

Before you start: Select an event.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-CAL-01 | Calendar | Open Calendar and switch between Event dates, Deadlines, Payment due dates and Approval deadlines. | Today is highlighted and the schedule list changes per tab. |
| CL-CAL-02 | Approvals overview | Open Approvals. | Proposal, Contracts, Quotations, Layouts and Final Confirmation show their current status. |

### CL-CLO · Event Closeout

Before you start: Needs an event that PMCM has marked as wrapped up.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CL-CLO-01 | Acknowledge wrap-up and deliverables | Open the Summary tab and acknowledge the wrap-up and each deliverable. | Each item shows as acknowledged. |
| CL-CLO-02 | Rating and feedback | Give a rating and feedback. | Your rating and feedback are saved. |
| CL-CLO-03 | Testimonial consent | Add a testimonial with consent, then withdraw the consent. | The testimonial is saved, then shows consent withdrawn. |
| CL-CLO-04 | Archived event is read-only | Open an archived event. | It opens on Summary and nothing can be changed. |

## Supplier

Supplier portal. Apply and Status need no account. Dashboard pages need an approved supplier account.

### SU-APP · Supplier Application

Before you start: Stay signed out. Open the supplier portal and go to Apply.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-APP-01 | Company information | Leave Company Name blank and click Continue, then fill Company Name, Contact Person and Email. | You cannot continue with a blank required field. With them filled you reach Services & Portfolio. |
| SU-APP-02 | Services and portfolio | Open the Service Category list and pick a category, then continue. | Categories load from the system and you reach Certifications. |
| SU-APP-03 | Portfolio link check | Type an invalid Portfolio URL such as abc, then a valid https link. | The invalid link is refused and the valid link is accepted. |
| SU-APP-04 | Submit the application | On Review & Submit, try Submit without the privacy consent, then tick it and submit. | Submit needs consent. Application submitted is shown with a reference number. |
| SU-APP-05 | Check application status | Open Status and enter the reference and email. Then try a wrong email. | The correct pair shows the application status. A wrong pair shows a could not find error. |

### SU-ACC · Sign-in and Account Access

Before you start: Use the approved supplier account issued for UAT.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-ACC-01 | Sign in | Sign in with the supplier email and password. | The supplier dashboard opens. |
| SU-ACC-02 | Wrong password | Sign in with a wrong password. | A red error appears and you stay on sign-in. |
| SU-ACC-03 | Wrong portal account | Sign in with a client or PMCM account. | You are refused with a wrong-portal message. |
| SU-ACC-04 | Request PMCM approval | Expand Need supplier access?, try sending without consent, then tick consent and click Request PMCM approval. | Consent is required. A confirmation notice appears. |
| SU-ACC-05 | Password reset request | Expand Need supplier access?, click Forgot password?, enter your email and click Request reset. | A status message confirms the request. |
| SU-ACC-06 | Sign out | Click Sign out. | You return to sign-in and the dashboard needs a new sign-in. |

### SU-DSH · Dashboard Overview and Calendar

Before you start: Sign in as a supplier with at least one quote request or booking.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-DSH-01 | Overview | Open Dashboard. | Greeting, stats and the readiness board grouped by event are shown. |
| SU-DSH-02 | Sidebar counts and refresh | Compare the sidebar badges with the Requests and Bookings pages, then click Refresh. | Badge counts match the pages and data reloads. |
| SU-DSH-03 | Calendar | Open Calendar. | Quote deadlines and event dates are listed. Past dates are struck through and today is labelled Today. |

### SU-QUO · Quote Requests and Quotations

Before you start: Needs an open quote request from PMCM.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-QUO-01 | Submit a quote | Open Requests. Enter amount 0 and submit, then enter a valid amount, payment terms and inclusions and click Submit quote. | Amount 0 is refused. The valid quote is saved and the card shows the amount and status. |
| SU-QUO-02 | Revise a quote | Change the amount and click Save revision. | The revision number goes up and the new amount is shown. |
| SU-QUO-03 | Closed or selected request | Open a request that is closed, locked or already selected. | The form is read-only and the reason is shown. |
| SU-QUO-04 | Quotation history | Open Quotations. | Your quotes are listed with amount, revision, dates, payment terms and inclusions. |
| SU-QUO-05 | No access to other bids | Look through Requests and Quotations for other suppliers' quotes. | Only your own quotes are visible. |

### SU-BKG · Bookings, Contracts and Event Day

Before you start: Needs a booking where PMCM selected your quote.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-BKG-01 | Confirm assignment | Open Bookings and click Confirm assignment. | The button changes to Assignment confirmed. |
| SU-BKG-02 | Confirm readiness | Enter readiness notes and click Confirm readiness. | Readiness shows as confirmed on the progress tracker. |
| SU-BKG-03 | Upload signed contract | Try uploading a JPG, then upload a PDF or DOCX contract. | Only PDF or DOCX is accepted. The upload is listed with version, file name and review status, and can be downloaded. |
| SU-BKG-04 | Schedule acknowledgment | When PMCM publishes a schedule, click Acknowledge. On another, try Request change without a reason, then with a reason. | Acknowledgment is recorded. A change request needs a reason. |
| SU-BKG-05 | Creative tasks | On a creative task, save a progress note, then submit a deliverable with a note or file. | Progress and the deliverable are saved. PMCM's review note appears when given. |
| SU-BKG-06 | Event-day status | Before confirming assignment and readiness, check the event-day buttons. After both, set Arrived, then Set up and ready, then Done and leaving. | Buttons are disabled until both are confirmed. Each status is recorded. A Late arrival warning appears after the planned ingress time. |

### SU-FIL · Files, Payments and Profile

Before you start: Sign in as a supplier with a booking.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-FIL-01 | Files | Open Files and download a contract file. | The requirements matrix, contract files with review status and certifications are shown. Download works. |
| SU-FIL-02 | Payments | Open Payments. | Milestones show scheduled, released and remaining amounts, due dates and release history. Nothing is editable. |
| SU-FIL-03 | Profile | Open Services / Profile. | Your supplier details are shown read-only with a privacy notice. |

### SU-MSG · Messages

Before you start: Needs a booking linked to an event with a PMCM thread.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| SU-MSG-01 | Send a message | Open Messages, check Send with an empty box, then send a message. | Send is disabled while empty. The message appears in the thread. |
| SU-MSG-02 | Read replies and history | Open a thread with a PMCM reply and click Load older messages. | The reply is visible, the thread is marked read and older messages load. |

## Guest

Guest portal. No account needed. Use the event access code from PMCM.

### GU-OPN · Open Event with Access Code

Before you start: Get the event access code from PMCM.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| GU-OPN-01 | Preview the event | Open the guest portal, click Open with code, type the code in lowercase and click Preview event. | The code turns uppercase and the event name, client and date are shown. |
| GU-OPN-02 | Wrong code | Enter a code that does not exist. | An error message is shown and no event opens. |
| GU-OPN-03 | Continue to the dashboard | After preview, click Continue. | The guest dashboard for that event opens. |
| GU-OPN-04 | Dashboard needs a code | In a private window, open the /dashboard address directly. | You are sent to the access-code page. |
| GU-OPN-05 | Leave event | On the dashboard click Leave event. | The pass is cleared and the access-code page opens. |

### GU-PAS · Event Pass and Details

Before you start: Open an event with a valid code.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| GU-PAS-01 | Event pass | Look at the event pass. | Event name, date and access code are shown. |
| GU-PAS-02 | Event details and next steps | Look at Event details and Your next steps. | Event, date, client, readiness and stage are shown. Next steps list check-in and feedback. |

### GU-CHK · Check-in

Before you start: Open an event that is not archived.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| GU-CHK-01 | Consent required | Choose check-in by name, enter your registered name and try Submit check-in without consent. | Check-in cannot be submitted without consent. |
| GU-CHK-02 | Check in by name | Tick consent and submit. | The button changes to Check-in submitted and check-in shows as done in next steps. |
| GU-CHK-03 | Check in by headcount | With another code session, choose headcount, tick consent and submit. | The headcount check-in is accepted and locked. |

### GU-FBK · Feedback

Before you start: Open an event that has ended (feedback is open for 7 days after the event).

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| GU-FBK-01 | Required fields and consent | Try to submit feedback without a name or without consent. | Feedback is refused until name and consent are given. |
| GU-FBK-02 | File limits | Attach a photo over 10 MB, or a video longer than 60 seconds. | The file is rejected with an error message. |
| GU-FBK-03 | Submit feedback | Enter name, choose 1 to 5 stars, add a comment, tick consent and submit. | Feedback is accepted and shown as complete in next steps. |

### GU-GAM · Event Games

Before you start: Needs a game published by PMCM and its 6-digit PIN or lobby link.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| GU-GAM-01 | Join with PIN | Open Join game and enter 123 and then a wrong 6-digit PIN, then the real PIN. | Short PINs ask for 6 digits, wrong PINs show This game is unavailable, the real PIN joins with an alias such as Guest 1234. |
| GU-GAM-02 | Event lobby | Open the lobby link from PMCM. | The event branding and the list of games are shown, each with a Start button. |
| GU-GAM-03 | Play a round | Answer the current prompt and submit. | Your answer locks for the round and your score and standings update. |
| GU-GAM-04 | Resume a session | Close the tab, reopen Join game and use the resume link. | You return to the same game session with the same alias. |

## PMCM Admin

Event command portal. Sign in with a pmcm-admin account. Billing corrections need a second admin account.

### AD-ACC · Sign-in and Account Access

Before you start: Use the PMCM admin account issued for UAT.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-ACC-01 | Sign in | Sign in with the admin email and password. | The PMCM dashboard opens with the full sidebar. |
| AD-ACC-02 | Wrong password | Sign in with a wrong password. | An error appears and you stay on sign-in. |
| AD-ACC-03 | Wrong portal account | Sign in with a client or supplier account. | You are refused with a link to the correct portal. |
| AD-ACC-04 | Protected pages | While signed out, open /dashboard directly, then sign in. | You are sent to sign in, then back to the dashboard. |
| AD-ACC-05 | Password reset request | Request a password reset by email. | A status message confirms the request. |

### AD-INB · Dashboard and Command Inbox

Before you start: Sign in as admin.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-INB-01 | Command inbox | Open the dashboard, refresh the inbox and change pages. | Inbox items load, the sidebar badge matches the count and paging works. |
| AD-INB-02 | Selected event summary | Select an event and click Open event on the summary card. | The summary matches the event and opens its workspace. |
| AD-INB-03 | Account requests | Approve one pending account request and decline another. | Each request leaves the pending list with the chosen result. |

### AD-INQ · Inquiries and Client Onboarding

Before you start: Submit a test inquiry from the client portal first.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-INQ-01 | Review a new inquiry | Open Inquiries and open the test inquiry. | The details match what the client submitted, with duplicate and previously-declined cues where they apply. |
| AD-INQ-02 | Pend and decline | Pend one inquiry. Decline another, first without a reason, then with a reason. | Pend is recorded. Decline needs a reason. |
| AD-INQ-03 | Merge duplicates | Merge a duplicate inquiry into its organization with a reason. | The merge needs a reason and shows in merge history. |
| AD-INQ-04 | Log on behalf of a client | Log an inquiry on behalf of a client, including How did you hear about us. | The inquiry is created and marked as logged by PMCM. |
| AD-INQ-05 | Accept and upload conforme | Accept the inquiry. Upload a non-PDF as the signed conforme, then a PDF under 10 MB. | Non-PDF files are refused. After the PDF upload the event workspace is created and the client can open their portal. |
| AD-INQ-06 | Conforme reminder and follow-up | Send a conforme reminder, then generate a follow-up draft and click Approve and queue for delivery. | The reminder is recorded and the draft is queued, not sent instantly. |

### AD-CLI · Clients

Before you start: Sign in as admin.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-CLI-01 | Client list and details | Open Clients and open a client. | Contact, company, event and inquiry counts and balance are shown. |
| AD-CLI-02 | Client events | Open the client's events view and click an event. | The event workspace opens. |
| AD-CLI-03 | Archived event search | Search archived events by venue, event type or month. | Matching archived events are listed. |

### AD-TSK · Tasks and Ocular Visits

Before you start: Needs an event with an ocular visit request.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-TSK-01 | Schedule and complete an ocular | Open Tasks, schedule an ocular visit, then mark it complete. | Status changes to scheduled, then completed. |
| AD-TSK-02 | Waive an ocular | Waive an ocular visit without a reason, then with a reason. | A reason is required and the waiver is recorded. |
| AD-TSK-03 | Action center links | Click each action-center count. | Each link opens the matching list (inquiries, approvals, quotes, payments, checks). |

### AD-OVR · Event Overview, Briefing and Change Control

Before you start: Open an event in planning.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-OVR-01 | Briefing and compliance | On Overview submit the event briefing and run planning compliance. Open the Briefing tab. | The briefing is saved and shown on the Briefing tab. Compliance results appear. |
| AD-OVR-02 | Scope change requests | Start review on a client change request, then approve or reject it with a reason. | The decision needs a reason and the client sees the new status. |
| AD-OVR-03 | Freeze scope and exceptions | Freeze scope with a reason, then create and approve a freeze exception. | Freeze needs a reason. The exception is listed and used once. |
| AD-OVR-04 | Cancellation or postponement | Record a postponement with a new date and deposit treatment (use a test event). | The impact review is shown and the decision is recorded. |
| AD-OVR-05 | Secondary contacts and access code | Grant floorplan access to an approved client account. Check the guest access code. | The contact is added. The guest access code is shown, or Pending if not yet generated. |

### AD-FLR · Floorplans

Before you start: Open an event and go to Floorplans.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-FLR-01 | Create from template | Start a new draft from a saved venue template. | The draft opens with the template layout. |
| AD-FLR-02 | Edit and save | Add and move items in the editor and save. | Changes are kept after reopening the draft. |
| AD-FLR-03 | Table assignment rules | Assign more guests to a table than it holds and save. | The save is refused with a clear reason. |
| AD-FLR-04 | Submit and approve | Submit a draft for review, then approve it. | Submit only shows for new or needs-revision drafts. Approve only shows for drafts in review. |
| AD-FLR-05 | Client preference | Open a client's submitted preference and reopen it with a note. | The client's preference is shown and the client can revise it again. |

### AD-SUP · Event Suppliers

Before you start: Open an event and go to Suppliers.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-SUP-01 | Request and compare quotes | Request quotes for a category, then compare received quotes and select one. | Suppliers receive the request. The selected quote is marked and others are closed. |
| AD-SUP-02 | Readiness board | Open the readiness board. | Each supplier's readiness is shown. A category with no selected quote shows a hard block. |
| AD-SUP-03 | Ingress schedule | Publish an ingress and egress schedule. | The supplier sees the schedule and can acknowledge it. |
| AD-SUP-04 | Contracts | Review a supplier contract upload and request a revision with a reason. | The supplier sees the revision request and reason. |
| AD-SUP-05 | Payables | Release a payable milestone, then reverse it. | Release and reversal are recorded and amounts update. |
| AD-SUP-06 | Emergency replacement | Withdraw a confirmed supplier (test event only). | A recommended replacement and draft messages are shown for PMCM to review. |

### AD-DIR · Supplier Directory and Applications

Before you start: Submit a test supplier application first.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-DIR-01 | Applications inbox | Open the test application and request a proposal, schedule a meeting or decline. | The status changes and the applicant sees it on the Status page. |
| AD-DIR-02 | Approve an application | Approve an application. | A directory supplier is created, pending its first event. |
| AD-DIR-03 | Create and edit a supplier | Create a supplier, then edit its profile, tier and BNI membership. | Changes are saved and shown in the directory. |
| AD-DIR-04 | Filters | Filter by category, tier and rating. | The list shows only matching suppliers. |

### AD-COR · Coordinators and Team

Before you start: Open an event and go to Coordinators.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-COR-01 | Assign with suggestions | Pick a role and assign a coordinator from the suggestions. | Suggestions show skill match and the coordinator is assigned. |
| AD-COR-02 | Same-date conflict | Assign a coordinator already booked on the same date. | The assignment is blocked and same-role alternatives are suggested. |
| AD-COR-03 | Event Day System Operator | Designate a coordinator as Event Day System Operator. | The designation is shown and that coordinator gets operator controls. |
| AD-COR-04 | Availability and reminders | Add an unavailable date for a coordinator and send an acknowledgment reminder. | The date blocks assignment and the reminder is recorded. |
| AD-COR-05 | Reliability history | Open a coordinator's reliability history. | Past assignments and withdrawals are listed. |

### AD-LIV · Live Ops and Run Sheet

Before you start: Open an event near or on event day.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-LIV-01 | Event-day tasks | Create a task with title, owner role, priority and SLA, then update and escalate it. | The task is listed and its status changes are shown. |
| AD-LIV-02 | Urgent issues | Log an issue with severity and area, then update it. | The issue is listed and its changes are shown. |
| AD-LIV-03 | Coordinator attendance | Mark coordinators present, late and absent. Replace an absent one using suggestions. | Attendance is recorded and the replacement is assigned. |
| AD-LIV-04 | Schedule and handoffs | Add a day and segments, record a shift handoff and reply to an end-of-day report. | Each entry is saved and shown. |
| AD-LIV-05 | Run sheet | Open Run sheet and print it. | Items are in time order and the print view is readable. |

### AD-REG · Registration and Guests

Before you start: Open an event and go to Registration.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-REG-01 | Registration setup | Set the registration platform type and min, max and expected guests. | The settings are saved. |
| AD-REG-02 | Guest roster | Import a guest roster, then search and filter it. | Guests are imported and search finds them. |
| AD-REG-03 | Check-in and verification | Verify and check in a guest from the roster. | The guest shows as verified and checked in. |
| AD-REG-04 | Walk-in and privacy settings | Set the walk-in policy open or closed with a threshold, and set guest privacy classification. | The settings are saved and apply at the registration desk. |

### AD-GAM · Event Games

Before you start: Open an event and go to Games.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-GAM-01 | Create and configure | Create a game from the catalog and set its questions or options. | The draft is saved with your configuration. |
| AD-GAM-02 | Lobby and branding | Set the lobby logo and theme, copy the lobby URL and show the PIN. | Guests opening the URL see your branding. The PIN is shown when you choose. |
| AD-GAM-03 | Run the game | Publish, start, go to the next round and end the game while a guest plays. | The guest screen follows each step and the leaderboard updates. |
| AD-GAM-04 | Moderation and awards | Hide a guest answer and assign an award. | The hidden answer disappears from shared results and the award is recorded. |

### AD-BIL · Billing and Finance

Before you start: Open an event with a billing statement. Correction approval needs a second admin account.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-BIL-01 | Record a payment | Record a payment of 0, then more than the milestone balance, then a valid amount (Bank Transfer, Cheque or GCash). | 0 and over-balance amounts are refused. The valid payment updates the balance. |
| AD-BIL-02 | Send the statement | Send the billing statement. | The send is logged in notification activity and the client sees the statement. |
| AD-BIL-03 | Disputes and waivers | Record a dispute above the statement total, then a valid one, and resolve or waive it with a reason. | The over-total dispute is refused. Resolve or waive needs a reason. |
| AD-BIL-04 | Additional billing | Issue additional billing from an approved billing source. | The additional billing appears on the statement. |
| AD-BIL-05 | Correction needs a second admin | Request a correction, try to approve it with the same admin, then approve it with a second admin. | Approve is disabled for the requester. The second admin can approve. |

### AD-CLO · Closure and Archive

Before you start: Open an event that has ended (use a test event).

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-CLO-01 | Record end and logistics | Record the actual end time. Try logistics completion before confirming asset returns, then after. | Logistics completion needs asset returns confirmed first and is then recorded. |
| AD-CLO-02 | Wrap-up and close gates | Complete the wrap-up and review the close gates. | Must-fix and advisory gates are shown with their status. |
| AD-CLO-03 | Archive rules | Try to archive with a failing gate and no reason, then give an override reason. | Archive is blocked without a reason and allowed with one. |
| AD-CLO-04 | Reviews, testimonials and feedback | Add a supplier review, approve a client testimonial and approve or hide a guest feedback item. | Each decision is saved. Hidden feedback is not shown publicly. |
| AD-CLO-05 | Compare archived events | Select 2 to 4 archived events and compare them. | A side-by-side comparison is shown. Fewer than 2 or more than 4 cannot be compared. |

### AD-MSG · Messages

Before you start: Open an event with a client.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-MSG-01 | Create a thread | On the event's Activity tab create a message thread and send a message. | The thread is created and the client can see the message. |
| AD-MSG-02 | Reply and history | Reply to a client message and click Load older messages. | The reply is shown and older messages load. |

### AD-FIL · Files and Requirements

Before you start: Select an event and open Files.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-FIL-01 | Requirements matrix | Add a requirement and set owner role, visibility, required flag and due date. | The requirement is saved and only the chosen roles can see it. |
| AD-FIL-02 | Document hub | Open the document hub and its links to floorplans, briefing, suppliers, billing and closure. | Each link opens the right area. |

### AD-AUD · Audit Trail and Decision Log

Before you start: Sign in as admin after doing a few actions.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-AUD-01 | Audit trail filters | Open Audit and filter by event, severity and user. | Your recent actions appear and filters narrow the list. |
| AD-AUD-02 | Decision log | Open an event's Decision log tab. | Overrides, approvals and scope decisions are listed with their reasons. |

### AD-PRV · Privacy Console

Before you start: Needs a test privacy request. Use test data only.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-PRV-01 | Queue and filters | Open Privacy and filter by type, status and owner. Assign a request to yourself. | The queue filters correctly and shows due dates. You become the owner. |
| AD-PRV-02 | Approve, reject and execute | Approve and execute an access/export request on test data. Reject another. | Execution returns the subject's data bundle. Rejection is recorded. |
| AD-PRV-03 | Legal hold | Place a legal hold, then lift it. | While on hold, related deletion is blocked. Lifting the hold is recorded. |

### AD-SET · Settings

Before you start: Sign in as admin.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| AD-SET-01 | Client event-day view switch | Open Settings and turn the Client event-day view switch on and off. | A saving state appears and the setting stays after reload. |

## Coordinator

Coordinator portal. Sign in with a coordinator account assigned to the test event.

### CO-ACC · Sign-in and Portal Scope

Before you start: Use the coordinator account issued for UAT.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CO-ACC-01 | Sign in | Sign in with the coordinator email and password. | The Coordinator Portal opens, not the PMCM command portal. |
| CO-ACC-02 | PMCM areas are closed | Type PMCM addresses such as /dashboard/finance or /dashboard/audit. | Only the Coordinator Portal is shown. No finance, audit, inquiry or supplier data is visible. |
| CO-ACC-03 | Role notice | Read the boundary notice. | It says coordinators only see data for their role. |

### CO-EVT · Event Switcher and Assignment

Before you start: Needs at least one assignment from PMCM.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CO-EVT-01 | Assigned events only | Open the event switcher. | Only events you are assigned to are listed, including past ones. |
| CO-EVT-02 | Acknowledge or decline | Acknowledge a new assignment. On another test assignment, decline or withdraw. | Each action is recorded and appears in assignment history. |
| CO-EVT-03 | Archived events | Switch to an archived event. | A read-only banner is shown and all forms are disabled. |

### CO-DAY · Event Day Work

Before you start: Select a current event you are assigned to.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CO-DAY-01 | Mark arrival | Mark your arrival. | Your attendance shows as arrived. |
| CO-DAY-02 | Role queue | Update the status of a task in your queue. | The new status is saved. |
| CO-DAY-03 | Request reassignment | Request reassignment of a task with a reason and a new role or coordinator. | The request is sent to the operator or PMCM. |
| CO-DAY-04 | Log task and urgent issue | Log an event-day task with priority and due time, and an urgent issue with severity and area. | Both are recorded and PMCM can see them in Live ops. |
| CO-DAY-05 | Timeline and briefing | Open the timeline and briefing. | The critical timeline and floor and stage briefing are shown, or a message if PMCM has not submitted the briefing. |

### CO-OPR · Event Day System Operator

Before you start: Sign in as the coordinator PMCM designated as operator. Some cases need a second, non-operator coordinator.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CO-OPR-01 | Delegated attendance | Mark another coordinator absent with Confirm absent. | Their attendance is updated. |
| CO-OPR-02 | Reassignment decisions | Approve one reassignment request and reject another. | Both decisions are recorded and the task owner updates. |
| CO-OPR-03 | Edit the schedule | Add a day and a segment. | The schedule is updated. |
| CO-OPR-04 | Non-operator cannot edit | Sign in as a non-operator coordinator and open the schedule. | A message says only the designated operator can edit the schedule. |

### CO-SUP · Supplier Setup Checks

Before you start: Sign in as the operator or an Ingress and Egress coordinator.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CO-SUP-01 | Verify setup | Verify a supplier's setup. | The setup shows as verified and PMCM sees it. |
| CO-SUP-02 | Dispute setup | Dispute another supplier's setup with a note. | The dispute is recorded and PMCM sees it. |

### CO-REG · Registration Desk

Before you start: Sign in as a Registration Staff coordinator assigned to the event.

| ID | Test case | Steps | Expected result |
| --- | --- | --- | --- |
| CO-REG-01 | Search the roster | Search the guest roster by name. | Matching guests are listed with limited details. |
| CO-REG-02 | Check in a guest | Verify and check in a guest. | The guest shows as checked in. |
| CO-REG-03 | Register a walk-in | Register a walk-in without consent, then with consent, then verify and check them in. | Consent is required. The walk-in follows the PMCM walk-in policy and can be checked in after verification. |
| CO-REG-04 | Archived event | Switch to an archived event and try to check in a guest. | The roster can be read but check-in is refused. |
