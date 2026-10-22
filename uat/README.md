# P.R.I.S.M Google Forms UAT

One form covers the existing question bank: 5 roles, 51 modules, 197 test cases.
Each submission records one module. Owner D (Anthony).

## Create the Google Form

1. Open [Google Apps Script](https://script.google.com/home/start), sign in, and create a project.
2. Replace the contents of `Code.gs` with **all** of [PRISM-UAT-Google-Form.gs](PRISM-UAT-Google-Form.gs). This combined file includes the question bank and builder. Do not add the separate source files as well.
3. No portal URL configuration is needed. The form displays portal names without links.
4. Save. Select `buildUatForm` in the function dropdown and click **Run**. Review and authorize the Google Forms access request for this project.
5. Read the execution log. If it asks you to run again, run the same function again. It resumes the same draft and removes an unfinished module before retrying. Do not manually edit the draft until the build finishes.
6. Open the **Edit link** from the completed execution log. Preview at least one module for each role, including comments with multiple case IDs. Check the supplied account and event prerequisites against your test environment.
7. Review responder access, then publish the form in Google Forms and copy its responder link. The builder creates an unpublished draft. You can link a response spreadsheet from the form's **Responses** tab.

Running the completed builder again prints the same links. To create a separate form after changing the question bank, run `resetUatBuild`, then `buildUatForm`. Resetting only clears the builder's saved state; it preserves the previous form and its responses.

The live form has not been created or tested in a signed-in Google account. Local verification uses a simulated Apps Script Forms service; it checks the generated items, routes, validation patterns, and interrupted-build recovery.

## Seed portal test data

Use the explicit accounts and portal-uat CLI profiles in the canonical
[environment and fixture runbook](../docs/runbooks/environments-and-fixtures.md).
Select the private environment file, preview the target, seed missing accounts,
then seed scenarios with an explicit live-event date in Asia/Manila. Reruns
preserve tester edits and existing passwords; verify reports missing records.

The six October 21 seed migrations remain immutable historical artifacts. New
seeding does not require a database-wide opt-in flag or ALTER DATABASE. The name
Talga came from that historical procedure; its exact hosted project mapping is
not established by this repository. Verify the selected target before use.

## Tester flow

1. **What is your user role?** Required multiple choice: Client, Supplier, Guest, PMCM Admin, Coordinator.
2. **What module would you test?** Required multiple choice in the selected role's section. Only that role's modules appear.
3. Read the module setup, steps, and expected results. Rate every test case in the module's required multiple-choice grid. Columns are:
   - Passed - Working
   - Partially Passed - Works but needs revision (w/ comment)
   - Fail - Not Working
   - Skipped - Di tinest (w/ comment)
4. Complete the required module comment box, titled exactly:

   > IF YOU SELECT PARTIALLY PASSED OR SKIPPED Please may we know your suggestion or the part that need to improve STRICTLY
   >
   > Format: Test Case ID - Comment

   Put each comment on its own line. Use only case IDs from the selected module, for example:

   ```text
   CL-INQ-02 - Show a message beside each missing contact field.
   CL-INQ-05 - Skipped because the API was unavailable.
   ```

   Comment on every Partially Passed or Skipped case. Explain a failure where possible. If no case is Partially Passed or Skipped, enter a case ID from that module followed by ` - No revision or skipped-case comment needed.`
5. Enter tester name and test date, then submit. The form skips every other module. Use **Submit another response** to test the next module.

## Validation and review

The selected format uses one ratings grid and one required comment box per module. Google Forms validates that the comment is non-empty and each line starts with a case ID belonging to that module. It does **not** compare grid ratings with comment lines. A reviewer must check that every Partially Passed or Skipped case has its own explanation. The form cannot judge whether an explanation is useful.

Role selection routes the questionnaire; it does not authenticate the tester's application role. Testers still need the correct portal accounts and event assignments.

The builder creates 167 items including page breaks, across 58 sections. This fits Google's documented [300 content items and 75 sections](https://support.google.com/docs/answer/2839737?hl=en). The previous per-case comment-page layout exceeded those limits.

The supplied test cases are the existing UAT bank. This delivery converts its format; it does not certify that every case passes or re-audit current implementation coverage. The [question bank](UAT-question-bank.md) contains all steps and expected results.

## Maintain and verify

Edit `uat-test-cases.gs` for test content and portal names. Edit `build-uat-form.gs` for form behavior. Rebuild the combined file and check it:

```powershell
node uat/export-google-form.cjs
node --test uat/google-form.test.cjs
```

Google Forms reference: [grid items](https://developers.google.com/apps-script/reference/forms/grid-item), [paragraph validation](https://developers.google.com/apps-script/reference/forms/paragraph-text-validation-builder), [page-break navigation](https://developers.google.com/apps-script/reference/forms/page-break-item), and [unpublished form creation](https://developers.google.com/apps-script/reference/forms/form-app#create(String,Boolean)).
