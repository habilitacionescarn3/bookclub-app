const termsContent = `
Terms of Service
Last updated: 5/18/2026

1
Acceptance of Terms
By accessing or using our services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.

2
Platform as a Facilitator
Community Library is a neutral facilitation platform only.

We provide the digital infrastructure to allow users to list and discover items for exchange. We do not own, sell, resell, provide, control, manage, offer, or deliver any items listed on the platform.

3
Limitation of Liability & Items
Crucial Disclaimer:

WE ARE NOT RESPONSIBLE FOR THE ITEMS EXCHANGED. We make no representations or warranties, express or implied, regarding the condition, safety, legality, quality, or authenticity of any items listed or exchanged through the platform.

Any exchange of items is strictly between the users involved. We are NOT liable for any loss, damage, injury, or legal issue arising from your use of the platform to facilitate these transactions.

4
User Interactions & Safety
Users are solely responsible for their interactions with other members of the community. You agree to take all necessary precautions when meeting other individuals for item exchanges. You assume ALL risk associated with your use of the platform.

5
Indemnification
You agree to release, defend, indemnify, and hold Community Library and its affiliates harmless from and against any claims, liabilities, damages, losses, and expenses, including without limitation, reasonable legal and accounting fees, arising out of or in any way connected with your access to or use of the service or your violation of these Terms.

6
Independent Software Platform and Global Use
Community Library is an independent software platform that may be used by individuals, residents, groups, apartments, housing societies, residential communities, associations, or similar communities from any location across the globe.

No apartment association, residential society, management committee, residents’ welfare association, or similar body has any exclusive ownership, control, or legal right over the general usage of this software platform unless a separate written agreement exists with Community Library.

Users are free to sign up, access, use, participate in, or leave the platform at any time, subject to these Terms of Service and any applicable laws.

7
Social Networking and Community Interaction Platform
This system should be treated as a community-based social networking and facilitation platform.

The platform allows users to connect, communicate, list items, discover shared resources, and voluntarily interact with other users.

Any participation, communication, listing, borrowing, lending, sharing, or exchange of items is done directly between users.

Community Library does not act as a society-controlled platform, rental service, seller, reseller, delivery provider, broker, guarantor, or owner of any item or interaction.

8
User Responsibility to Review Terms
It is the responsibility of each user to read, review, and stay informed about these Terms of Service from time to time.

By signing up for, accessing, or using the platform, the user confirms that they have read, understood, and agreed to these Terms of Service.

Once a user is onboarded onto the platform or starts using the platform, it will be deemed that the user has accepted and agreed to these Terms of Service.

9
Updates to Terms
Community Library may update, modify, or revise these Terms of Service from time to time.

Whenever these Terms of Service are materially changed, Community Library will make reasonable efforts to notify users by email, platform notification, or any other suitable communication method.

Continued access to or use of the platform after such updates will be treated as acceptance of the updated Terms of Service.

Users are encouraged to review the Terms of Service periodically to remain aware of any changes.

10
User Content, Community Moderation, and Legal Responsibility
Users are solely responsible for any content, messages, listings, images, comments, posts, or other material they upload, publish, share, or transmit through the platform.

Users must not upload, publish, share, or transmit insulting, abusive, harassing, threatening, defamatory, obscene, hateful, discriminatory, unlawful, or otherwise inappropriate content.

Any user who uploads, publishes, shares, or transmits such content is solely liable for the consequences of that content and will bear any legal consequences, claims, penalties, damages, or proceedings arising from it.

Admins, moderators, or managers of communities, groups, apartments, housing societies, residential communities, associations, or similar groups using the platform must make reasonable efforts to maintain a respectful and safe environment. They should act as quickly as reasonably possible to detect, review, delete, restrict, or otherwise address inappropriate content, and where necessary, report such content or conduct to the appropriate authorities.

Community Library provides software infrastructure only and has no legal obligation to pre-screen, monitor, control, verify, approve, or be responsible for content uploaded, posted, shared, or transmitted by users.

However, Community Library may invest in tools, processes, reporting mechanisms, automated detection, manual review, or other reasonable measures to identify, restrict, remove, or address insulting, abusive, unlawful, or inappropriate content. Any failure, delay, error, or inability to detect, remove, restrict, or act on such content will not make Community Library legally liable for that content or for any consequences arising from it.

The individual user who uploads, publishes, shares, or transmits such content remains solely responsible. Community Library may take appropriate action against such users, including content removal, warnings, account restrictions, suspension, permanent banning, reporting to relevant authorities, or any other platform-related action considered appropriate.

Users should promptly report insulting, abusive, unlawful, or inappropriate content to the relevant community admins, moderators, or managers so that they may review and delete or otherwise address such content.

11
User Exit and Data Removal
Users are free to stop using the platform or request to leave the system at any time.

Once a user decides to leave the system, Community Library may deactivate or remove the user’s account and associated user data from the platform, subject to applicable laws, platform policies, technical feasibility, and any legal or operational retention requirements.

After a user leaves the platform, Community Library is not obligated to share, return, export, or provide any data, content, records, history, listings, messages, or platform-related information back to the user in any form, unless required by applicable law or expressly agreed in writing.

Community Library may retain limited records where required for legal compliance, fraud prevention, dispute resolution, security, backup, audit, or legitimate operational purposes.
`;

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 text-gray-800">
      <pre className="whitespace-pre-wrap font-sans text-base leading-7">
        {termsContent}
      </pre>
    </div>
  );
}
