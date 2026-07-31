import type { MissionUnderstandingArtifactV1 } from "@cluvvi/core";

export type CategoryKey = "video" | "sales" | "recruiting" | "finance" | "support" | "fallback";

export interface BuyerTemplate {
  label: string;
  whyTheyMightNeedIt: string;
  likelyBuyerTitles: string[];
  likelyUserTitles: string[];
  confidence: number;
  searchModifiers: string[];
}

export interface CategoryConfig {
  label: string;
  keywords: string[];
  productAction: string;
  defaultOutcome: string;
  buyers: BuyerTemplate[];
  painKeywords: string[];
  competitorKeywords: string[];
  workflowTerms: string[];
}

export const CATEGORY_CONFIGS: Record<CategoryKey, CategoryConfig> = {
  video: {
    label: "AI video production / editing software",
    keywords: [
      "video",
      "editing",
      "rough cut",
      "youtube",
      "podcast",
      "creator",
      "content",
      "premiere",
      "post-production",
    ],
    productAction: "reducing manual editing and accelerating the long-form production workflow",
    defaultOutcome: "publish long-form video and podcast content faster with less manual editing",
    buyers: [
      {
        label: "Podcast agencies",
        whyTheyMightNeedIt:
          "They manage recurring client episodes and feel editing-turnaround pressure as production volume grows.",
        likelyBuyerTitles: ["Agency founder", "Head of production", "Operations director"],
        likelyUserTitles: ["Podcast producer", "Video editor", "Content producer"],
        confidence: 0.9,
        searchModifiers: ["podcast agency", "podcast production company", "client podcast editing"],
      },
      {
        label: "YouTube production agencies",
        whyTheyMightNeedIt:
          "They need repeatable rough-cut workflows across multiple channels without expanding editor headcount at the same rate.",
        likelyBuyerTitles: ["Agency owner", "Creative director", "Head of video"],
        likelyUserTitles: ["YouTube producer", "Video editor", "Channel manager"],
        confidence: 0.9,
        searchModifiers: [
          "YouTube production agency",
          "YouTube editing agency",
          "channel production team",
        ],
      },
      {
        label: "B2B content teams",
        whyTheyMightNeedIt:
          "They turn webinars, interviews, and thought leadership into consistent video but often have editing backlogs.",
        likelyBuyerTitles: ["Head of content", "VP Marketing", "Content marketing director"],
        likelyUserTitles: ["Content producer", "Video marketer", "Multimedia specialist"],
        confidence: 0.84,
        searchModifiers: ["B2B content team", "video marketing team", "webinar production"],
      },
      {
        label: "Creator-led media businesses",
        whyTheyMightNeedIt:
          "Publishing frequency directly affects audience and revenue, making slow post-production an expensive bottleneck.",
        likelyBuyerTitles: ["Creator founder", "Media founder", "Chief of staff"],
        likelyUserTitles: ["Content producer", "Video editor", "Channel operator"],
        confidence: 0.82,
        searchModifiers: ["creator media business", "creator team", "YouTube media company"],
      },
      {
        label: "Online education teams",
        whyTheyMightNeedIt:
          "Course launches and lesson updates create bursts of long-form editing work with deadline pressure.",
        likelyBuyerTitles: ["Course creator", "Head of learning", "Education business owner"],
        likelyUserTitles: ["Learning content producer", "Video editor", "Course producer"],
        confidence: 0.74,
        searchModifiers: [
          "online course team",
          "education video production",
          "course content producer",
        ],
      },
      {
        label: "Marketing agencies producing long-form content",
        whyTheyMightNeedIt:
          "Client video demand can outgrow internal editing capacity and compress agency margins.",
        likelyBuyerTitles: ["Agency founder", "Client services director", "Production lead"],
        likelyUserTitles: ["Content producer", "Video editor", "Account manager"],
        confidence: 0.78,
        searchModifiers: [
          "marketing agency video",
          "long-form content agency",
          "client video production",
        ],
      },
    ],
    painKeywords: [
      "editing turnaround",
      "video editing backlog",
      "hiring video editor",
      "rough cuts",
      "podcast production",
      "content repurposing",
      "long-form video workflow",
      "production bottleneck",
      "missed publishing schedule",
      "editing cost",
      "post-production capacity",
      "manual video editing",
    ],
    competitorKeywords: [
      "Descript",
      "CapCut",
      "Premiere Pro",
      "Final Cut Pro",
      "OpusClip",
      "Riverside",
      "hiring freelancers",
      "manual editing",
      "editing agency",
    ],
    workflowTerms: ["video editor", "podcast producer", "content producer", "post-production"],
  },
  sales: {
    label: "AI sales / GTM software",
    keywords: [
      "lead",
      "sales",
      "prospect",
      "outreach",
      "gtm",
      "customer",
      "pipeline",
      "sdr",
      "outbound",
      "demo",
    ],
    productAction: "identifying buying intent and turning it into relevant sales conversations",
    defaultOutcome: "find higher-intent prospects and start more qualified outbound conversations",
    buyers: [
      {
        label: "B2B SaaS founders",
        whyTheyMightNeedIt:
          "Early-stage founders need repeatable customer acquisition before they can justify a larger sales team.",
        likelyBuyerTitles: ["Founder", "Co-founder", "CEO"],
        likelyUserTitles: ["Founder", "Growth lead", "Founding salesperson"],
        confidence: 0.91,
        searchModifiers: ["B2B SaaS founder", "early-stage SaaS", "founder-led sales"],
      },
      {
        label: "Small sales teams",
        whyTheyMightNeedIt:
          "Limited headcount makes low-quality prospecting and unanswered outreach disproportionately expensive.",
        likelyBuyerTitles: ["Head of sales", "VP Sales", "Sales manager"],
        likelyUserTitles: ["SDR", "Account executive", "Sales development lead"],
        confidence: 0.88,
        searchModifiers: ["small sales team", "startup SDR team", "B2B outbound team"],
      },
      {
        label: "Outbound agencies",
        whyTheyMightNeedIt:
          "Their margins and client retention depend on consistently finding responsive, relevant prospects.",
        likelyBuyerTitles: ["Agency founder", "Managing director", "Head of delivery"],
        likelyUserTitles: ["Campaign manager", "SDR", "Lead researcher"],
        confidence: 0.87,
        searchModifiers: [
          "outbound agency",
          "lead generation agency",
          "appointment setting agency",
        ],
      },
      {
        label: "Startup studios",
        whyTheyMightNeedIt:
          "They repeatedly validate new offers and need a reusable way to find early buyers across portfolio companies.",
        likelyBuyerTitles: ["Studio partner", "Venture builder", "Operating partner"],
        likelyUserTitles: ["Growth operator", "GTM lead", "Founder in residence"],
        confidence: 0.76,
        searchModifiers: ["startup studio", "venture studio GTM", "portfolio growth team"],
      },
      {
        label: "RevOps and GTM operators",
        whyTheyMightNeedIt:
          "They are accountable for pipeline quality, tool efficiency, routing, and measurable conversion improvements.",
        likelyBuyerTitles: ["Head of RevOps", "VP Revenue", "GTM operations lead"],
        likelyUserTitles: [
          "Revenue operations manager",
          "GTM engineer",
          "Sales operations analyst",
        ],
        confidence: 0.82,
        searchModifiers: ["RevOps team", "GTM operations", "revenue operations startup"],
      },
      {
        label: "Lead-generation service businesses",
        whyTheyMightNeedIt:
          "They need better prospect quality and evidence of intent to differentiate from commodity list providers.",
        likelyBuyerTitles: ["Founder", "Operations director", "Client strategy lead"],
        likelyUserTitles: ["Lead researcher", "Campaign manager", "Outbound specialist"],
        confidence: 0.78,
        searchModifiers: [
          "lead generation service",
          "demand generation agency",
          "prospecting service",
        ],
      },
    ],
    painKeywords: [
      "first customers",
      "warm leads",
      "high intent leads",
      "cold outreach",
      "no replies",
      "lead generation",
      "sales pipeline",
      "booked demos",
      "prospecting",
      "outbound not working",
      "poor lead quality",
      "manual account research",
    ],
    competitorKeywords: [
      "Apollo",
      "Clay",
      "Gojiberry",
      "Instantly",
      "Smartlead",
      "Lemlist",
      "ZoomInfo",
      "HubSpot",
      "spreadsheets",
      "manual LinkedIn outreach",
    ],
    workflowTerms: ["SDR", "sales development", "lead researcher", "RevOps"],
  },
  recruiting: {
    label: "Recruiting / talent software",
    keywords: ["hiring", "recruit", "candidate", "interview", "talent", "applicant"],
    productAction:
      "reducing manual recruiting work and helping teams move qualified candidates faster",
    defaultOutcome:
      "find and move qualified candidates through the hiring process with less manual work",
    buyers: [
      {
        label: "Startup talent teams",
        whyTheyMightNeedIt:
          "Fast-growing startups need recruiting throughput without adding excessive coordination work.",
        likelyBuyerTitles: ["Head of talent", "VP People", "Founder"],
        likelyUserTitles: ["Recruiter", "Talent partner", "Recruiting coordinator"],
        confidence: 0.88,
        searchModifiers: ["startup talent team", "startup recruiter", "high-growth hiring"],
      },
      {
        label: "Recruiting agencies",
        whyTheyMightNeedIt:
          "Agency economics improve when researchers and recruiters spend less time on manual administration.",
        likelyBuyerTitles: ["Agency founder", "Managing director", "Recruitment director"],
        likelyUserTitles: ["Recruiter", "Sourcer", "Research associate"],
        confidence: 0.86,
        searchModifiers: ["recruiting agency", "staffing agency", "executive search firm"],
      },
      {
        label: "People operations teams",
        whyTheyMightNeedIt:
          "They coordinate hiring workflows and feel delays across interview scheduling, feedback, and handoffs.",
        likelyBuyerTitles: ["Head of People", "People operations director", "HR director"],
        likelyUserTitles: ["People operations manager", "Recruiting coordinator", "HR generalist"],
        confidence: 0.76,
        searchModifiers: ["people operations team", "HR operations", "internal recruiting team"],
      },
      {
        label: "Companies hiring at volume",
        whyTheyMightNeedIt:
          "High requisition volume exposes bottlenecks in sourcing, screening, scheduling, and candidate communication.",
        likelyBuyerTitles: ["Talent acquisition director", "HR leader", "Operations leader"],
        likelyUserTitles: ["Recruiter", "Coordinator", "Hiring manager"],
        confidence: 0.8,
        searchModifiers: ["volume hiring", "rapid hiring", "multiple open roles"],
      },
    ],
    painKeywords: [
      "candidate sourcing",
      "recruiting backlog",
      "interview scheduling",
      "slow hiring process",
      "candidate screening",
      "recruiter workload",
      "hiring coordination",
      "talent pipeline",
      "candidate drop-off",
      "manual recruiting workflow",
    ],
    competitorKeywords: [
      "LinkedIn Recruiter",
      "Greenhouse",
      "Lever",
      "Ashby",
      "Workable",
      "spreadsheets",
      "recruiting agency",
      "manual sourcing",
    ],
    workflowTerms: ["recruiter", "talent acquisition", "sourcer", "recruiting coordinator"],
  },
  finance: {
    label: "Finance / accounting software",
    keywords: ["finance", "invoice", "accounting", "bookkeeping", "tax", "reconciliation"],
    productAction: "automating repetitive financial operations and reducing reporting delays",
    defaultOutcome: "complete finance and accounting workflows faster with fewer manual errors",
    buyers: [
      {
        label: "Small finance teams",
        whyTheyMightNeedIt:
          "Lean teams own recurring close, reporting, and reconciliation work with limited automation capacity.",
        likelyBuyerTitles: ["Head of finance", "Finance director", "Controller"],
        likelyUserTitles: ["Accountant", "Finance manager", "Bookkeeper"],
        confidence: 0.87,
        searchModifiers: ["small finance team", "startup finance", "lean accounting team"],
      },
      {
        label: "Accounting firms",
        whyTheyMightNeedIt:
          "Client volume creates repetitive document, bookkeeping, tax, and reporting workflows.",
        likelyBuyerTitles: ["Firm owner", "Managing partner", "Practice director"],
        likelyUserTitles: ["Accountant", "Bookkeeper", "Tax preparer"],
        confidence: 0.85,
        searchModifiers: ["accounting firm", "bookkeeping firm", "tax practice"],
      },
      {
        label: "Founder-led businesses",
        whyTheyMightNeedIt:
          "Founders often manage finance operations manually before hiring dedicated specialists.",
        likelyBuyerTitles: ["Founder", "CEO", "COO"],
        likelyUserTitles: ["Founder", "Operations manager", "Office manager"],
        confidence: 0.72,
        searchModifiers: ["small business finance", "founder bookkeeping", "startup accounting"],
      },
      {
        label: "Operations teams with billing responsibility",
        whyTheyMightNeedIt:
          "Billing, collections, and reconciliation delays directly affect cash flow and customer experience.",
        likelyBuyerTitles: ["COO", "Operations director", "Finance operations lead"],
        likelyUserTitles: [
          "Billing specialist",
          "Operations manager",
          "Accounts receivable specialist",
        ],
        confidence: 0.75,
        searchModifiers: ["finance operations", "billing operations", "accounts receivable team"],
      },
    ],
    painKeywords: [
      "month-end close",
      "manual reconciliation",
      "invoice backlog",
      "bookkeeping workload",
      "late payments",
      "tax preparation",
      "financial reporting delay",
      "accounting errors",
      "billing workflow",
      "cash flow visibility",
    ],
    competitorKeywords: [
      "QuickBooks",
      "Xero",
      "FreshBooks",
      "NetSuite",
      "spreadsheets",
      "outsourced bookkeeper",
      "manual reconciliation",
      "accounting firm",
    ],
    workflowTerms: ["accountant", "bookkeeper", "finance manager", "controller"],
  },
  support: {
    label: "Customer support software",
    keywords: [
      "support",
      "ticket",
      "customer service",
      "helpdesk",
      "help desk",
      "customer success",
    ],
    productAction: "reducing repetitive support work and improving response speed and consistency",
    defaultOutcome: "resolve customer questions faster while reducing manual support workload",
    buyers: [
      {
        label: "B2B SaaS support teams",
        whyTheyMightNeedIt:
          "Ticket growth and product complexity can outpace support headcount and response-time goals.",
        likelyBuyerTitles: ["Head of support", "VP Customer Success", "COO"],
        likelyUserTitles: [
          "Support agent",
          "Customer success manager",
          "Support operations manager",
        ],
        confidence: 0.88,
        searchModifiers: [
          "B2B SaaS support",
          "software support team",
          "customer success operations",
        ],
      },
      {
        label: "E-commerce customer service teams",
        whyTheyMightNeedIt:
          "Order, delivery, return, and product questions create repetitive high-volume support queues.",
        likelyBuyerTitles: [
          "Customer experience director",
          "E-commerce operations lead",
          "Support manager",
        ],
        likelyUserTitles: ["Customer service agent", "Support specialist", "CX operations manager"],
        confidence: 0.84,
        searchModifiers: ["e-commerce support team", "online store customer service", "CX team"],
      },
      {
        label: "Support outsourcing agencies",
        whyTheyMightNeedIt:
          "Their margins depend on agent productivity, quality control, and handling volume across clients.",
        likelyBuyerTitles: ["Agency founder", "Delivery director", "Operations director"],
        likelyUserTitles: ["Support agent", "Team lead", "Quality analyst"],
        confidence: 0.78,
        searchModifiers: ["customer support agency", "outsourced support", "BPO support team"],
      },
      {
        label: "Customer success teams",
        whyTheyMightNeedIt:
          "Repeated product questions and reactive ticket work reduce time available for retention and expansion.",
        likelyBuyerTitles: ["VP Customer Success", "Head of CX", "Chief Customer Officer"],
        likelyUserTitles: [
          "Customer success manager",
          "Support specialist",
          "Implementation manager",
        ],
        confidence: 0.76,
        searchModifiers: [
          "customer success team",
          "SaaS customer experience",
          "customer operations",
        ],
      },
    ],
    painKeywords: [
      "support ticket backlog",
      "slow response time",
      "repetitive customer questions",
      "helpdesk workload",
      "support staffing",
      "customer service bottleneck",
      "ticket deflection",
      "support quality",
      "customer response SLA",
      "manual support workflow",
    ],
    competitorKeywords: [
      "Zendesk",
      "Intercom",
      "Freshdesk",
      "Help Scout",
      "Gorgias",
      "shared inbox",
      "support outsourcing",
      "manual macros",
    ],
    workflowTerms: ["support agent", "customer service", "customer success", "support operations"],
  },
  fallback: {
    label: "B2B software or service",
    keywords: [],
    productAction: "reducing manual workflow friction in the described business process",
    defaultOutcome: "complete the described workflow faster with fewer manual delays",
    buyers: [
      {
        label: "Founders and operators matching the described workflow",
        whyTheyMightNeedIt:
          "They directly own the workflow, its cost, and the operational consequences of delays.",
        likelyBuyerTitles: ["Founder", "COO", "Operations director"],
        likelyUserTitles: ["Operations manager", "Program manager", "Specialist"],
        confidence: 0.64,
        searchModifiers: ["founder", "operator", "operations team"],
      },
      {
        label: "Teams hiring for the workflow",
        whyTheyMightNeedIt:
          "Active hiring indicates capacity pressure, growing volume, or an unresolved manual process.",
        likelyBuyerTitles: ["Department head", "Operations leader", "Hiring manager"],
        likelyUserTitles: ["Team lead", "Specialist", "Coordinator"],
        confidence: 0.68,
        searchModifiers: ["hiring", "growing team", "open role"],
      },
      {
        label: "Agencies delivering the workflow for clients",
        whyTheyMightNeedIt:
          "Service firms benefit when the workflow becomes faster, more repeatable, and less dependent on headcount.",
        likelyBuyerTitles: ["Agency founder", "Managing director", "Operations director"],
        likelyUserTitles: ["Delivery manager", "Specialist", "Account manager"],
        confidence: 0.66,
        searchModifiers: ["agency", "service provider", "client delivery team"],
      },
      {
        label: "Companies using competitor or workaround tools",
        whyTheyMightNeedIt:
          "Existing workaround usage proves the problem is important enough to spend time or money solving.",
        likelyBuyerTitles: ["Department head", "Operations leader", "Technology lead"],
        likelyUserTitles: ["Operations specialist", "Analyst", "Coordinator"],
        confidence: 0.62,
        searchModifiers: ["manual process", "spreadsheet workflow", "existing vendor"],
      },
    ],
    painKeywords: [
      "manual process delays",
      "workflow bottleneck",
      "operational backlog",
      "repetitive work",
      "handoff delays",
      "process errors",
      "capacity constraints",
      "missed deadlines",
      "spreadsheet workflow",
      "tool fragmentation",
    ],
    competitorKeywords: [
      "spreadsheet",
      "freelancer",
      "agency",
      "manual process",
      "Zapier",
      "Airtable",
      "existing vendor",
    ],
    workflowTerms: ["operations specialist", "coordinator", "analyst", "program manager"],
  },
};

export const INTENT_SIGNALS: MissionUnderstandingArtifactV1["intentSignals"] = [
  {
    label: "hiring_for_related_role",
    description: "The company is adding headcount for the same workflow the product improves.",
    examplePhrases: ["we are hiring", "join our team", "looking for a specialist"],
    scoreWeight: 5,
  },
  {
    label: "asking_for_tool_recommendation",
    description: "A person is actively comparing tools or asking peers what to use.",
    examplePhrases: ["best tool for", "what do you use", "any recommendations"],
    scoreWeight: 5,
  },
  {
    label: "complaining_about_manual_work",
    description: "The current workflow is slow, repetitive, or dependent on manual effort.",
    examplePhrases: ["takes too long", "doing this manually", "constant backlog"],
    scoreWeight: 5,
  },
  {
    label: "mentioning_competitor_or_workaround",
    description:
      "The company already uses a competitor, agency, freelancer, spreadsheet, or manual workaround.",
    examplePhrases: ["alternative to", "switching from", "using spreadsheets"],
    scoreWeight: 4,
  },
  {
    label: "increasing_volume_or_capacity",
    description: "Growing output, customers, campaigns, or workload is creating capacity pressure.",
    examplePhrases: ["scaling production", "volume increased", "cannot keep up"],
    scoreWeight: 4,
  },
  {
    label: "looking_for_agency_or_vendor",
    description: "The buyer is seeking outside help or a vendor for the workflow.",
    examplePhrases: ["looking for an agency", "need a vendor", "recommend a service"],
    scoreWeight: 5,
  },
  {
    label: "budget_or_price_mentioned",
    description:
      "A public discussion includes budget, price sensitivity, or cost of the current approach.",
    examplePhrases: ["budget is", "too expensive", "cost per month"],
    scoreWeight: 3,
  },
  {
    label: "urgent_deadline_or_bottleneck",
    description:
      "A deadline, launch, client commitment, or operational bottleneck makes the problem urgent.",
    examplePhrases: ["need this by", "blocking launch", "urgent help"],
    scoreWeight: 5,
  },
];

export const SOURCE_PLAN: MissionUnderstandingArtifactV1["sourcePlan"] = [
  {
    sourceType: "reddit",
    priority: "high",
    reason: "Raw complaints, founder and customer pain, and tool-recommendation discussions.",
  },
  {
    sourceType: "job_posts",
    priority: "high",
    reason: "Companies reveal workflows, tools, roles, and growing capacity needs through hiring.",
  },
  {
    sourceType: "search_web",
    priority: "high",
    reason: "Broad discovery of public posts, pages, lists, and buying-intent signals.",
  },
  {
    sourceType: "company_websites",
    priority: "medium",
    reason: "Verify company fit, positioning, workflow evidence, and current operating context.",
  },
  {
    sourceType: "reviews",
    priority: "medium",
    reason: "Competitor complaints and switching triggers reveal unresolved pain.",
  },
  {
    sourceType: "product_hunt",
    priority: "medium",
    reason: "Fresh launches and makers often expose active go-to-market and workflow problems.",
  },
  {
    sourceType: "hacker_news",
    priority: "medium",
    reason:
      "Technical founders and startup operators discuss tools, constraints, and alternatives.",
  },
  {
    sourceType: "linkedin_manual",
    priority: "low",
    reason: "Manual research and drafting only; no scraping or automated messaging in the MVP.",
  },
];
