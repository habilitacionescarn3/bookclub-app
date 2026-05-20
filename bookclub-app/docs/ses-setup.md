# Amazon SES (Simple Email Service) Setup Guide

This guide provides step-by-step instructions for configuring Amazon SES to send system and admin notifications for **TownWink** and **NearBorrow**.

---

## 1. Domain vs. Email Address Verification

Amazon SES allows you to verify either a specific email address (e.g., `notify@townwink.com`) or an entire domain (e.g., `townwink.com`).

| Verification Type | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **Domain** | - Verifies all email addresses on that domain (e.g., `notify@`, `support@`, `admin@`).<br>- Automatically sets up DKIM for better email deliverability. | - Requires access to your DNS provider (e.g., Route 53, GoDaddy, Cloudflare) to add records. | **Recommended for Production** |
| **Email Address** | - Extremely fast to set up.<br>- Does not require DNS modifications. | - You can *only* send from the exact verified email address.<br>- Does not automatically verify the domain for DKIM. | **Recommended for Quick Dev Testing** |

---

## 2. Step-by-Step: Domain Verification (Recommended)

Verifying your domain is the most robust option. It authorizes SES to send emails from any address ending in `@yourdomain.com` and automatically configures DKIM (DomainKeys Identified Mail) to prevent your emails from going to spam.

### Step 2.1: Create the Domain Identity in AWS
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. Select the correct region from the top right corner:
   * **ap-south-1 (Mumbai)** for India / TownWink.
   * **us-east-1 (N. Virginia)** for Australia / NearBorrow.
3. Search for and open **Amazon Simple Email Service (SES)**.
4. In the left navigation pane, under **Configuration**, click **Verified Identities**.
5. Click **Create Identity**.
6. Select **Domain** under *Identity Type*.
7. In the **Domain** field, enter your domain name (e.g., `townwink.com` or `booklub.shop`).
8. Under **DKIM (DomainKeys Identified Mail)**:
   * Keep **Easy DKIM** selected.
   * Under **DKIM signatures key length**, select **RSA_2048_BIT** (Recommended).
   * Leave **Publish DNS records** checked (if using Route 53 under the same AWS account).
9. Under **Advanced configurations** (Optional):
   * **Custom MAIL FROM domain**: If you enable this, you **cannot** use the main domain (e.g., `townwink.com`). It **MUST be a subdomain** (e.g., `mail.townwink.com` or `bounce.townwink.com`).
   * *Recommendation*: For a quick setup, **do not select** "Use a custom MAIL FROM domain". Leave it disabled. SES will send emails using its default MAIL FROM domain (`amazonses.com`), which works perfectly out of the box.
10. Click **Create Identity**.

### Step 2.2: Publish DNS Records
After creation, AWS will generate a set of DNS records (CNAME and TXT) that you must add to your domain registrar.

#### Case A: If your DNS is managed in Route 53 (Same AWS Account)
If Route 53 hosts the domain in the same AWS account:
1. AWS SES will automatically offer to create these records for you.
2. If not automatically created, scroll down to the **DKIM** tab on the identity page.
3. Click **Publish DNS Records to Route 53** (if visible) to apply them instantly.

#### Case B: If your DNS is managed elsewhere (GoDaddy, Cloudflare, Namecheap, etc.)
1. Scroll down to the **DKIM** tab on the identity page.
2. Copy the three **CNAME** records shown in the table:
   * **Name**: Usually looks like `xxxxxxx._domainkey.townwink.com`
   * **Type**: `CNAME`
   * **Value**: Usually looks like `xxxxxxx.dkim.amazonses.com`
3. Go to your domain registrar/DNS provider control panel.
4. Add the three CNAME records to your DNS zone file.
5. *(Optional)* Add a TXT record for **SPF** if you do not have one:
   * **Name**: `@` or blank
   * **Type**: `TXT`
   * **Value**: `v=spf1 include:amazonses.com ~all`
6. Wait 5–15 minutes. In the AWS SES Console under **Verified Identities**, your domain status will transition from `Pending Verification` to `Verified` (green).

---

## 3. Step-by-Step: Individual Email Verification (Quick Test)

If you do not have DNS access or want to test email sending quickly, you can verify just the sender and receiver email addresses.

1. In the **AWS SES Console**, go to **Verified Identities**.
2. Click **Create Identity**.
3. Select **Email address** under *Identity Type*.
4. Enter the email address you wish to verify:
   * **Sender**: `notify@townwink.com` (or `notify@booklub.shop`).
   * **Recipient**: `madhukar.pedagani@gmail.com` (and other admin emails).
5. Click **Create Identity**.
6. A verification email will be sent to the address from `Amazon Web Services`. Open the email and click the verification link.
7. Under **Verified Identities**, the status will change to **Verified**.

> [!WARNING]
> While your account is in the **SES Sandbox**, you **MUST** repeat this process to verify *every* recipient email address that will receive notifications. Otherwise, AWS will reject the emails.

---

## 4. How to Request Sandbox Removal (Move to Production)

To send emails to your users automatically when they join without verifying them individually, you must request production access:

1. Go to the **Amazon SES Dashboard** in the AWS Console.
2. In the right-hand panel or top banner, locate the **Account details** box and click **Request Production Access** (or **Request Sandbox Removal**).
3. Fill out the request form:
   * **Mail Type**: Transactional (system notifications, sign-ups, etc.)
   * **Website URL**: `https://townwink.com` (or `https://booklub.shop`)
   * **Use Case Description**:
     > "We send automated transactional emails to users when they register a new account on our platform (TownWink/NearBorrow). These emails are user-triggered sign-up confirmations and notifications about system updates. We only send transactional content and maintain an opt-out policy."
   * **Bounce and Complaint Handling**:
     > "We monitor bounces and complaints through standard AWS CloudWatch alerts and handle users opting out of email categories directly within our platform settings."
4. Submit the request. AWS typically reviews and approves sandbox removals within 24 hours.

---

## 5. Verifying in Logs

Once configured, watch your lambda logs in CloudWatch. A successful email send will log:
```text
[Notify][SES] Sent email { to: 'madhukar.pedagani@gmail.com', messageId: '0100018b...' }
```
If verification is missing or failed, it will log:
```text
[Notify][SES] Failed to send email { to: '...', subject: '...', error: 'MessageRejected: Email address is not verified.' }
```
