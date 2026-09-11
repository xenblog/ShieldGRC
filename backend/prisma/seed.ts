/* eslint-disable no-console */
import { PrismaClient, UserRole, RiskStatus, TreatmentStrategy, NistCsfFunction, AssessmentStatus, TreatmentActionStatus, ControlType, ControlFrequency, ControlEffectiveness, TestResult, TestMethod, BusinessProcessCriticalityTier } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { computeScore, scoreToBand } from '../src/common/scoring/scoring.util';
import { ControlBasedResidualScoringStrategy } from '../src/common/scoring/residual-scoring.strategy';

const prisma = new PrismaClient();

// Shared dev password for every seeded local account. This is intentionally
// simple and well-known - it is for local development / first deploy only.
// Rotate every seeded user's password (or disable local login entirely once
// Entra ID SSO is configured) before this instance handles real data. See
// README.md "First deploy" section.
const SEED_PASSWORD = 'DagrofaShield2026!';

async function main() {
  console.log('Seeding DagrofaShield...');

  // ---------------------------------------------------------------------
  // Org Units
  // ---------------------------------------------------------------------
  const [orgAps, orgLogistik, orgFoodservice] = await Promise.all([
    prisma.orgUnit.upsert({
      where: { name: 'Dagrofa ApS' },
      update: {},
      create: { name: 'Dagrofa ApS', code: 'APS' },
    }),
    prisma.orgUnit.upsert({
      where: { name: 'Dagrofa Logistik' },
      update: {},
      create: { name: 'Dagrofa Logistik', code: 'LOG' },
    }),
    prisma.orgUnit.upsert({
      where: { name: 'Dagrofa Foodservice' },
      update: {},
      create: { name: 'Dagrofa Foodservice', code: 'FS' },
    }),
  ]);

  // ---------------------------------------------------------------------
  // Category taxonomy (configurable, admin-editable)
  // ---------------------------------------------------------------------
  const categoryNames = [
    'Access Control',
    'Threat / Malware',
    'Data Protection',
    'Third Party',
    'Business Continuity',
    'Vulnerability Mgmt',
    'Cryptography',
  ];
  const categories: Record<string, Awaited<ReturnType<typeof prisma.category.upsert>>> = {};
  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: { sortOrder: i },
      create: { name, sortOrder: i },
    });
  }
  const catAccess = categories['Access Control'];
  const catThreat = categories['Threat / Malware'];
  const catData = categories['Data Protection'];
  const catThirdParty = categories['Third Party'];
  const catContinuity = categories['Business Continuity'];
  const catVuln = categories['Vulnerability Mgmt'];
  const catCrypto = categories['Cryptography'];

  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  async function upsertUser(email: string, name: string, role: UserRole, orgUnitIds: string[]) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash, status: 'ACTIVE', source: 'MANUAL', lastLoginAt: new Date() },
    });
    for (const orgUnitId of orgUnitIds) {
      await prisma.userOrgUnit.upsert({
        where: { userId_orgUnitId: { userId: user.id, orgUnitId } },
        update: {},
        create: { userId: user.id, orgUnitId },
      });
    }
    return user;
  }

  const admin = await upsertUser('admin@dagrofa.dk', 'Admin Administrator', UserRole.ADMIN, [
    orgAps.id,
    orgLogistik.id,
    orgFoodservice.id,
  ]);
  const riskOwnerAps = await upsertUser('anna.poulsen@dagrofa.dk', 'Anna Poulsen', UserRole.RISK_OWNER, [orgAps.id]);
  const riskOwnerLogistik = await upsertUser('lars.jensen@dagrofa.dk', 'Lars Jensen', UserRole.RISK_OWNER, [
    orgLogistik.id,
  ]);
  const riskOwnerFoodservice = await upsertUser(
    'freja.nielsen@dagrofa.dk',
    'Freja Nielsen',
    UserRole.RISK_OWNER,
    [orgFoodservice.id],
  );
  const auditor = await upsertUser('anders.auditor@dagrofa.dk', 'Anders Auditor', UserRole.AUDITOR, [
    orgAps.id,
    orgLogistik.id,
  ]);
  const executive = await upsertUser('eva.direktion@dagrofa.dk', 'Eva Direktion', UserRole.EXECUTIVE, []);

  // Admin-created-ahead-of-time account that has never signed in - status
  // stays Invited (and lastLoginAt null) until their first successful
  // login. No passwordHash: this account is meant to be claimed via Entra
  // ID SSO, which this dev/seed environment does not have configured.
  const invitedRiskOwner = await prisma.user.upsert({
    where: { email: 'thomas.krogh@dagrofa.dk' },
    update: {},
    create: {
      email: 'thomas.krogh@dagrofa.dk',
      name: 'Thomas Krogh',
      role: UserRole.RISK_OWNER,
      status: 'INVITED',
      source: 'MANUAL',
    },
  });
  await prisma.userOrgUnit.upsert({
    where: { userId_orgUnitId: { userId: invitedRiskOwner.id, orgUnitId: orgFoodservice.id } },
    update: {},
    create: { userId: invitedRiskOwner.id, orgUnitId: orgFoodservice.id },
  });

  // ---------------------------------------------------------------------
  // Methodology (versioned rich text reference page)
  // ---------------------------------------------------------------------
  const existingMethodology = await prisma.methodologyVersion.findFirst({ where: { isCurrent: true } });
  if (!existingMethodology) {
    await prisma.methodologyVersion.create({
      data: {
        version: 1,
        isCurrent: true,
        authorId: admin.id,
        frameworkReference: 'NIST SP 800-30 Rev. 1',
        contentHtml: `
          <h2>Sandsynligheds- og konsekvensskala</h2>
          <p>Alle risici vurderes på en skala fra 1 til 5 for både sandsynlighed og konsekvens:</p>
          <ul>
            <li><strong>1 - Meget lav:</strong> Sjældnere end hvert 10. år / minimal påvirkning</li>
            <li><strong>2 - Lav:</strong> Hvert 3.-10. år / begrænset påvirkning</li>
            <li><strong>3 - Middel:</strong> Årligt / mærkbar driftsmæssig eller økonomisk påvirkning</li>
            <li><strong>4 - Høj:</strong> Flere gange årligt / alvorlig påvirkning af drift, omdømme eller økonomi</li>
            <li><strong>5 - Meget høj:</strong> Forventes / kritisk påvirkning, potentielt selskabstruende</li>
          </ul>
          <h2>Scoringsbånd</h2>
          <p>Risikoscore = sandsynlighed × konsekvens (1-25), inddelt i bånd:</p>
          <ul>
            <li><strong>Low:</strong> &lt; 4</li>
            <li><strong>Medium:</strong> 4-7</li>
            <li><strong>High:</strong> 8-14</li>
            <li><strong>Critical:</strong> &ge; 15</li>
          </ul>
          <h2>Risikoappetit</h2>
          <p>Dagrofa accepterer Low- og Medium-risici inden for normal driftsledelse uden yderligere eskalering.
          High-risici kræver en dokumenteret behandlingsplan og kvartalsvis opfølgning af risikoejeren. Critical-risici
          eskaleres til koncernsikkerhed og direktionen inden for 5 arbejdsdage og kræver en godkendt behandlingsplan
          før risikoen kan accepteres som resterende risiko.</p>
          <h2>Vurderingskadence og -proces</h2>
          <p>Risikoregisteret gennemgås løbende af risikoejere og formelt af koncernsikkerhed hvert kvartal.
          Hver risiko skal have en "næste gennemgangsdato"; overskrides denne, flages risikoen som forfalden
          til gennemgang. Risikovurderinger (Risk Assessments) gennemføres mindst årligt pr. forretningsenhed,
          eller ved væsentlige ændringer i trusselsbillede, systemlandskab eller regulatoriske krav.</p>
        `.trim(),
      },
    });
  }

  // ---------------------------------------------------------------------
  // Risks
  // ---------------------------------------------------------------------
  const now = new Date();
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  interface RiskSeed {
    key: string;
    title: string;
    description: string;
    category: typeof catAccess;
    orgUnitId: string;
    ownerId: string;
    status: RiskStatus;
    likelihood: number;
    impact: number;
    treatmentStrategy?: TreatmentStrategy;
    treatmentNote?: string;
    // Manual override for the live-computed residual score - see
    // ResidualScoringService. Most seed risks leave this unset so the
    // computed value (from any linked Controls added below) shows through.
    residualScoreOverride?: number;
    notes?: string;
    nextReviewDate?: Date;
  }

  const riskSeeds: RiskSeed[] = [
    {
      key: 'mfa',
      title: 'Utilstrækkelig MFA-dækning på fjernadgang',
      description:
        'Ikke alle systemer med ekstern adgang kræver multi-faktor autentificering, hvilket øger risikoen for kontokompromittering.',
      category: catAccess,
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      status: RiskStatus.MITIGATING,
      likelihood: 4,
      impact: 4,
      treatmentStrategy: TreatmentStrategy.REDUCE,
      treatmentNote: 'Udrulning af MFA til alle fjernadgangsløsninger i gang.',
      // No override - linked to CTL-001 below, so residualScore is the
      // live-computed value.
      nextReviewDate: daysFromNow(60),
    },
    {
      key: 'firmware',
      title: 'Forældede firmware-versioner på lagerstyringssystemer',
      description: 'Flere lagerstyringsenheder kører firmware uden aktiv sikkerhedsopdatering fra leverandøren.',
      category: catVuln,
      orgUnitId: orgLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: RiskStatus.ASSESSED,
      likelihood: 3,
      impact: 4,
      nextReviewDate: daysFromNow(45),
    },
    {
      key: 'kryptering',
      title: 'Manglende kryptering af bærbare enheder',
      description: 'En del af de udleverede bærbare computere i Foodservice-divisionen har ikke fuld diskkryptering aktiveret.',
      category: catCrypto,
      orgUnitId: orgFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      status: RiskStatus.MITIGATING,
      likelihood: 3,
      impact: 3,
      treatmentStrategy: TreatmentStrategy.REDUCE,
      treatmentNote: 'Central udrulning af BitLocker-politik via MDM.',
      nextReviewDate: daysFromNow(90),
    },
    {
      key: 'logging',
      title: 'Utilstrækkelig logging af adgang til kundedata',
      description: 'Adgang til systemer med persondata om kunder logges ikke konsistent på tværs af platforme.',
      category: catData,
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      status: RiskStatus.IDENTIFIED,
      likelihood: 3,
      impact: 5,
      nextReviewDate: daysFromNow(30),
    },
    {
      key: 'ai-governance',
      title: 'AI-model til efterspørgselsprognose mangler governance',
      description: 'Den interne AI-model, der bruges til efterspørgselsprognoser, har ikke en dokumenteret ejerskabs- eller kontrolstruktur.',
      category: catData,
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      status: RiskStatus.IDENTIFIED,
      likelihood: 2,
      impact: 3,
      nextReviewDate: daysFromNow(120),
    },
    {
      key: 'skygge-ai',
      title: 'Skygge-AI-værktøjer anvendt af medarbejdere',
      description: 'Medarbejdere anvender eksterne generative AI-værktøjer uden central godkendelse, herunder til dokumenter med interne data.',
      category: catData,
      orgUnitId: orgLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: RiskStatus.ASSESSED,
      likelihood: 4,
      impact: 3,
      nextReviewDate: daysFromNow(45),
    },
    {
      key: 'leverandoer-beredskab',
      title: 'Kritisk leverandør uden dokumenteret beredskabsplan',
      description: 'En nøgleleverandør til lagerdriften kan ikke fremvise en opdateret og testet beredskabsplan.',
      category: catThirdParty,
      orgUnitId: orgLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: RiskStatus.MITIGATING,
      likelihood: 3,
      impact: 5,
      treatmentStrategy: TreatmentStrategy.TRANSFER,
      treatmentNote: 'Kontraktkrav om beredskabsplan under forhandling.',
      // No override - linked to CTL-013 below (currently FAIL), so
      // residualScore is the live-computed value.
      nextReviewDate: daysFromNow(60),
    },
    {
      key: 'koeletransport',
      title: 'Enkeltleverandør-afhængighed for køletransport',
      description: 'Størstedelen af den kølede transportkapacitet leveres af én enkelt leverandør uden reel backup-kapacitet.',
      category: catContinuity,
      orgUnitId: orgFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      status: RiskStatus.ACCEPTED,
      likelihood: 4,
      impact: 4,
      treatmentStrategy: TreatmentStrategy.ACCEPT,
      treatmentNote: 'Ledelsen har accepteret risikoen givet manglende reelle alternativer på kort sigt.',
      residualScoreOverride: 16,
      nextReviewDate: daysFromNow(180),
    },
    {
      key: 'adgangskontrol-lager',
      title: 'Utilstrækkelig adgangskontrol i lagerhaller',
      description: 'Adgangskort deles i praksis mellem flere medarbejdere i enkelte lagerhaller.',
      category: catAccess,
      orgUnitId: orgLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: RiskStatus.IDENTIFIED,
      likelihood: 2,
      impact: 3,
      nextReviewDate: daysFromNow(90),
    },
    {
      key: 'brandsikring',
      title: 'Manglende brandsikring i serverrum',
      description: 'Et af de mindre serverrum mangler automatisk brandslukningsanlæg.',
      category: catContinuity,
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      status: RiskStatus.MITIGATING,
      likelihood: 2,
      impact: 5,
      treatmentStrategy: TreatmentStrategy.REDUCE,
      treatmentNote: 'Installation af brandslukningsanlæg planlagt.',
      nextReviewDate: daysFromNow(75),
    },
    {
      key: 'phishing',
      title: 'Phishing-modstandsdygtighed blandt medarbejdere',
      description: 'Seneste phishing-simulation viste en klikrate over målsætningen blandt Foodservice-medarbejdere.',
      category: catThreat,
      orgUnitId: orgFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      status: RiskStatus.MITIGATING,
      likelihood: 4,
      impact: 3,
      treatmentStrategy: TreatmentStrategy.REDUCE,
      treatmentNote: 'Skærpet awareness-træningsprogram igangsat.',
      // No override - linked to CTL-005 below, so residualScore is the
      // live-computed value.
      nextReviewDate: daysFromNow(45),
    },
    {
      key: 'ot-it-segmentering',
      title: 'Manglende segmentering af OT/IT-netværk på lager',
      description: 'Driftsteknologi (OT) på automatiserede lagre er ikke tilstrækkeligt segmenteret fra det almindelige IT-netværk.',
      category: catAccess,
      orgUnitId: orgLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: RiskStatus.ASSESSED,
      likelihood: 3,
      impact: 5,
      nextReviewDate: daysFromNow(30),
    },
    {
      key: 'gdpr-deling',
      title: 'GDPR-efterlevelse ved deling af persondata med leverandører',
      description: 'Historisk manglede der databehandleraftaler med enkelte leverandører, der modtog persondata.',
      category: catData,
      orgUnitId: orgFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      status: RiskStatus.CLOSED,
      likelihood: 2,
      impact: 4,
      treatmentStrategy: TreatmentStrategy.REDUCE,
      treatmentNote: 'Databehandleraftaler er nu på plads med alle relevante leverandører.',
      residualScoreOverride: 2,
      nextReviewDate: daysFromNow(365),
    },
    {
      key: 'offsite-backup',
      title: 'Manglende offsite-backup af kritiske systemer',
      description: 'Backup af enkelte forretningskritiske systemer opbevares kun on-premise.',
      category: catContinuity,
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      status: RiskStatus.MITIGATING,
      likelihood: 2,
      impact: 5,
      treatmentStrategy: TreatmentStrategy.REDUCE,
      treatmentNote: 'Offsite/cloud-backup-løsning under udrulning.',
      // Intentionally in the past to demonstrate the overdue-review flag.
      nextReviewDate: daysFromNow(-10),
    },
    {
      key: 'besoegsregistrering',
      title: 'Mindre uoverensstemmelse i besøgsregistrering',
      description: 'Enkelte besøgende i hovedkontoret er ikke konsekvent registreret ved indgang.',
      category: catAccess,
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      status: RiskStatus.IDENTIFIED,
      likelihood: 1,
      impact: 2,
      nextReviewDate: daysFromNow(120),
    },
  ];

  const risks: Record<string, Awaited<ReturnType<typeof prisma.risk.create>>> = {};
  for (const seed of riskSeeds) {
    const existing = await prisma.risk.findFirst({ where: { title: seed.title, orgUnitId: seed.orgUnitId } });
    if (existing) {
      risks[seed.key] = existing;
      continue;
    }
    const inherent = computeScore(seed.likelihood, seed.impact);
    // residualScore/residualBand/residualSource get their real value below,
    // once Controls exist and can be linked - see "Recompute residual
    // scores" further down (mirrors ResidualScoringService, which the seed
    // script bypasses by writing directly via Prisma).
    risks[seed.key] = await prisma.risk.create({
      data: {
        title: seed.title,
        description: seed.description,
        categoryId: seed.category.id,
        orgUnitId: seed.orgUnitId,
        ownerId: seed.ownerId,
        status: seed.status,
        likelihood: seed.likelihood,
        impact: seed.impact,
        inherentScore: inherent.score,
        inherentBand: inherent.band,
        treatmentStrategy: seed.treatmentStrategy,
        treatmentNote: seed.treatmentNote,
        residualScoreOverride: seed.residualScoreOverride ?? null,
        notes: seed.notes,
        nextReviewDate: seed.nextReviewDate,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Risk Assessments + linked risks + treatment actions
  // ---------------------------------------------------------------------
  async function upsertAssessment(
    name: string,
    scope: string,
    orgUnitId: string,
    leadAssessorId: string,
    status: AssessmentStatus,
    startOffsetDays: number,
    dueOffsetDays: number,
    linkedRiskKeys: string[],
  ) {
    let assessment = await prisma.riskAssessment.findFirst({ where: { name } });
    if (!assessment) {
      assessment = await prisma.riskAssessment.create({
        data: {
          name,
          scope,
          orgUnitId,
          leadAssessorId,
          status,
          startDate: daysFromNow(startOffsetDays),
          dueDate: daysFromNow(dueOffsetDays),
          linkedRisks: { create: linkedRiskKeys.map((key) => ({ riskId: risks[key].id })) },
        },
      });
    }
    return assessment;
  }

  const assessmentAps = await upsertAssessment(
    'Q3 2026 IT-sikkerhedsvurdering - Dagrofa ApS',
    'Årlig gennemgang af IT- og informationssikkerhedsrisici for Dagrofa ApS, inkl. opfølgning på tidligere identificerede svagheder.',
    orgAps.id,
    riskOwnerAps.id,
    AssessmentStatus.IN_PROGRESS,
    -30,
    30,
    ['mfa', 'logging', 'brandsikring', 'offsite-backup'],
  );

  const assessmentLogistik = await upsertAssessment(
    'Leverandør- og lagerrisikovurdering 2026 - Dagrofa Logistik',
    'Vurdering af kritiske leverandører og relaterede fysiske/IT-risici for logistikdivisionens lagre.',
    orgLogistik.id,
    riskOwnerLogistik.id,
    AssessmentStatus.PLANNED,
    0,
    60,
    ['leverandoer-beredskab', 'adgangskontrol-lager', 'ot-it-segmentering'],
  );

  const assessmentFoodservice = await upsertAssessment(
    'AI- og informationssikkerhedsgennemgang - Dagrofa Foodservice',
    'Gennemgang af informationssikkerhed og tidlig AI-værktøjsbrug i Foodservice-divisionen.',
    orgFoodservice.id,
    riskOwnerFoodservice.id,
    AssessmentStatus.UNDER_REVIEW,
    -90,
    -10,
    ['kryptering', 'koeletransport', 'phishing', 'gdpr-deling'],
  );

  interface TreatmentActionSeed {
    description: string;
    riskKey: string;
    assessmentId?: string;
    ownerId: string;
    status: TreatmentActionStatus;
    dueOffsetDays: number;
  }

  const treatmentActionSeeds: TreatmentActionSeed[] = [
    {
      description: 'Udrul MFA til alle fjernadgang-brugere',
      riskKey: 'mfa',
      assessmentId: assessmentAps.id,
      ownerId: riskOwnerAps.id,
      status: TreatmentActionStatus.IN_PROGRESS,
      dueOffsetDays: 20,
    },
    {
      description: 'Implementer central logging til SIEM for adgang til kundedata',
      riskKey: 'logging',
      assessmentId: assessmentAps.id,
      ownerId: riskOwnerAps.id,
      status: TreatmentActionStatus.COMPLETED,
      dueOffsetDays: -5,
    },
    {
      description: 'Etabler offsite/cloud-backup-løsning hos ekstern part',
      riskKey: 'offsite-backup',
      assessmentId: assessmentAps.id,
      ownerId: riskOwnerAps.id,
      status: TreatmentActionStatus.NOT_STARTED,
      dueOffsetDays: 40,
    },
    {
      description: 'Indhent dokumenteret og testet beredskabsplan fra kritisk leverandør',
      riskKey: 'leverandoer-beredskab',
      assessmentId: assessmentLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: TreatmentActionStatus.IN_PROGRESS,
      dueOffsetDays: 45,
    },
    {
      description: 'Opgrader adgangskontrolsystem i lagerhal B (individuelle kort)',
      riskKey: 'adgangskontrol-lager',
      assessmentId: assessmentLogistik.id,
      ownerId: riskOwnerLogistik.id,
      status: TreatmentActionStatus.NOT_STARTED,
      dueOffsetDays: 55,
    },
    {
      description: 'Implementer databehandleraftaler med alle relevante leverandører',
      riskKey: 'gdpr-deling',
      assessmentId: assessmentFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      status: TreatmentActionStatus.COMPLETED,
      dueOffsetDays: -30,
    },
    {
      description: 'Gennemfør phishing-simulationstræning for alle medarbejdere',
      riskKey: 'phishing',
      assessmentId: assessmentFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      status: TreatmentActionStatus.COMPLETED,
      dueOffsetDays: -20,
    },
    // Standalone treatment actions, created directly from a Risk (no assessment).
    {
      description: 'Overvåg markedet for alternative køletransportleverandører (kvartalsvist)',
      riskKey: 'koeletransport',
      ownerId: riskOwnerFoodservice.id,
      status: TreatmentActionStatus.IN_PROGRESS,
      dueOffsetDays: 30,
    },
    {
      description: 'Udarbejd politik for godkendte AI-værktøjer og kommuniker til organisationen',
      riskKey: 'skygge-ai',
      ownerId: riskOwnerLogistik.id,
      status: TreatmentActionStatus.NOT_STARTED,
      dueOffsetDays: 50,
    },
  ];

  for (const seed of treatmentActionSeeds) {
    const existing = await prisma.treatmentAction.findFirst({
      where: { description: seed.description, riskId: risks[seed.riskKey].id },
    });
    if (existing) continue;
    await prisma.treatmentAction.create({
      data: {
        description: seed.description,
        riskId: risks[seed.riskKey].id,
        assessmentId: seed.assessmentId,
        ownerId: seed.ownerId,
        status: seed.status,
        dueDate: daysFromNow(seed.dueOffsetDays),
      },
    });
  }

  // Recompute assessment progress from seeded treatment actions.
  for (const assessment of [assessmentAps, assessmentLogistik, assessmentFoodservice]) {
    const [total, completed] = await Promise.all([
      prisma.treatmentAction.count({ where: { assessmentId: assessment.id } }),
      prisma.treatmentAction.count({
        where: { assessmentId: assessment.id, status: TreatmentActionStatus.COMPLETED },
      }),
    ]);
    await prisma.riskAssessment.update({
      where: { id: assessment.id },
      data: { progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0 },
    });
  }

  // ---------------------------------------------------------------------
  // Compliance Frameworks
  // (Group-wide frameworks are anchored on Dagrofa ApS as the coordinating
  // head-office entity - see ARCHITECTURE.md.)
  // ---------------------------------------------------------------------
  async function upsertFramework(name: string, description: string) {
    return prisma.framework.upsert({
      where: { name },
      update: {},
      create: { name, description, orgUnitId: orgAps.id, ownerId: admin.id },
    });
  }

  const nis2 = await upsertFramework(
    'NIS2',
    'EU-direktiv om net- og informationssikkerhed - koncernens tiltag til overholdelse af krav til risikostyring, hændelseshåndtering og leverandørsikkerhed.',
  );
  const iso27001 = await upsertFramework(
    'ISO 27001',
    'International standard for ledelsessystemer for informationssikkerhed (ISMS) - kontroller mappet til Annex A.',
  );
  const gdpr = await upsertFramework(
    'GDPR',
    'EU\'s databeskyttelsesforordning - kontroller der understøtter lovlig og sikker behandling af persondata.',
  );

  // ---------------------------------------------------------------------
  // Framework Controls - individual clauses within each Framework that a
  // Control Library Control maps to (e.g. ISO 27001:2022 "A.5.1"), not the
  // Framework as a whole.
  //
  // NOTE: this is a small, illustrative starter catalog, not a verified or
  // exhaustive transcription of the real standards - ISO 27001:2022 Annex A
  // alone has 93 controls. Verify codes/titles against your own copy of
  // each standard before relying on this for a real audit or certification;
  // add the rest via POST /api/framework-controls as needed.
  // ---------------------------------------------------------------------
  interface FrameworkControlSeed {
    key: string;
    framework: typeof nis2;
    code: string;
    title: string;
  }

  const frameworkControlSeeds: FrameworkControlSeed[] = [
    { key: 'iso5.1', framework: iso27001, code: 'A.5.1', title: 'Policies for information security' },
    { key: 'iso5.18', framework: iso27001, code: 'A.5.18', title: 'Access rights' },
    { key: 'iso5.19', framework: iso27001, code: 'A.5.19', title: 'Information security in supplier relationships' },
    { key: 'iso5.20', framework: iso27001, code: 'A.5.20', title: 'Addressing information security within supplier agreements' },
    { key: 'iso6.3', framework: iso27001, code: 'A.6.3', title: 'Information security awareness, education and training' },
    { key: 'iso7.2', framework: iso27001, code: 'A.7.2', title: 'Physical entry' },
    { key: 'iso7.5', framework: iso27001, code: 'A.7.5', title: 'Protecting against physical and environmental threats' },
    { key: 'iso8.5', framework: iso27001, code: 'A.8.5', title: 'Secure authentication' },
    { key: 'iso8.8', framework: iso27001, code: 'A.8.8', title: 'Management of technical vulnerabilities' },
    { key: 'iso8.13', framework: iso27001, code: 'A.8.13', title: 'Information backup' },
    { key: 'iso8.16', framework: iso27001, code: 'A.8.16', title: 'Monitoring activities' },
    { key: 'iso8.22', framework: iso27001, code: 'A.8.22', title: 'Segregation of networks' },
    { key: 'iso8.24', framework: iso27001, code: 'A.8.24', title: 'Use of cryptography' },
    { key: 'gdpr28', framework: gdpr, code: 'Art. 28', title: 'Processor' },
    { key: 'gdpr32', framework: gdpr, code: 'Art. 32', title: 'Security of processing' },
    { key: 'nis21', framework: nis2, code: 'Art. 21', title: 'Cybersecurity risk-management measures' },
  ];

  const frameworkControls: Record<string, Awaited<ReturnType<typeof prisma.frameworkControl.upsert>>> = {};
  for (const seed of frameworkControlSeeds) {
    frameworkControls[seed.key] = await prisma.frameworkControl.upsert({
      where: { frameworkId_code: { frameworkId: seed.framework.id, code: seed.code } },
      update: {},
      create: { frameworkId: seed.framework.id, code: seed.code, title: seed.title },
    });
  }

  // ---------------------------------------------------------------------
  // Control Library
  // ---------------------------------------------------------------------
  interface ControlSeed {
    code: string;
    name: string;
    category: typeof catAccess;
    orgUnitId: string;
    type: ControlType;
    frequency: ControlFrequency;
    nistCsfFunction?: NistCsfFunction;
    // Keys into frameworkControlSeeds above - the specific clause(s) this
    // control satisfies, not whole Frameworks.
    frameworkControlKeys: string[];
  }

  const controlSeeds: ControlSeed[] = [
    { code: 'CTL-001', name: 'Multi-faktor autentificering for fjernadgang', category: catAccess, orgUnitId: orgAps.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.CONTINUOUS, nistCsfFunction: NistCsfFunction.PROTECT, frameworkControlKeys: ['iso8.5', 'nis21'] },
    { code: 'CTL-002', name: 'Kvartalsvis sårbarhedsscanning', category: catVuln, orgUnitId: orgAps.id, type: ControlType.DETECTIVE, frequency: ControlFrequency.QUARTERLY, nistCsfFunction: NistCsfFunction.DETECT, frameworkControlKeys: ['iso8.8', 'nis21'] },
    { code: 'CTL-003', name: 'Patch management for serverinfrastruktur', category: catVuln, orgUnitId: orgLogistik.id, type: ControlType.CORRECTIVE, frequency: ControlFrequency.MONTHLY, nistCsfFunction: NistCsfFunction.PROTECT, frameworkControlKeys: ['iso8.8'] },
    { code: 'CTL-004', name: 'Netværkssegmentering mellem IT og OT', category: catAccess, orgUnitId: orgLogistik.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.ANNUAL, nistCsfFunction: NistCsfFunction.PROTECT, frameworkControlKeys: ['iso8.22', 'nis21'] },
    { code: 'CTL-005', name: 'Phishing-simulation og awareness-træning', category: catThreat, orgUnitId: orgFoodservice.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.QUARTERLY, nistCsfFunction: NistCsfFunction.PROTECT, frameworkControlKeys: ['iso6.3'] },
    { code: 'CTL-018', name: 'Offsite backup af kritiske systemer', category: catContinuity, orgUnitId: orgAps.id, type: ControlType.CORRECTIVE, frequency: ControlFrequency.WEEKLY, nistCsfFunction: NistCsfFunction.RECOVER, frameworkControlKeys: ['iso8.13', 'nis21'] },
    { code: 'CTL-006', name: 'Kryptering af data på bærbare enheder', category: catCrypto, orgUnitId: orgFoodservice.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.CONTINUOUS, frameworkControlKeys: ['iso8.24', 'gdpr32'] },
    { code: 'CTL-007', name: 'Adgangsstyring og periodisk rettighedsgennemgang', category: catAccess, orgUnitId: orgAps.id, type: ControlType.DETECTIVE, frequency: ControlFrequency.QUARTERLY, frameworkControlKeys: ['iso5.18'] },
    { code: 'CTL-008', name: 'Logning og overvågning af adgang til persondata', category: catData, orgUnitId: orgAps.id, type: ControlType.DETECTIVE, frequency: ControlFrequency.CONTINUOUS, frameworkControlKeys: ['iso8.16', 'gdpr32'] },
    { code: 'CTL-009', name: 'Databehandleraftaler med leverandører', category: catThirdParty, orgUnitId: orgFoodservice.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.ANNUAL, frameworkControlKeys: ['gdpr28'] },
    { code: 'CTL-010', name: 'Governance-proces for AI-systemer', category: catData, orgUnitId: orgAps.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.ANNUAL, frameworkControlKeys: ['iso5.1'] },
    { code: 'CTL-011', name: 'Register over AI-anvendelser', category: catData, orgUnitId: orgLogistik.id, type: ControlType.DETECTIVE, frequency: ControlFrequency.QUARTERLY, frameworkControlKeys: [] },
    { code: 'CTL-012', name: 'Due diligence af kritiske leverandører', category: catThirdParty, orgUnitId: orgLogistik.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.ANNUAL, frameworkControlKeys: ['iso5.19'] },
    { code: 'CTL-013', name: 'Beredskabsplan-gennemgang for nøgleleverandører', category: catThirdParty, orgUnitId: orgLogistik.id, type: ControlType.DETECTIVE, frequency: ControlFrequency.ANNUAL, frameworkControlKeys: ['iso5.20'] },
    { code: 'CTL-014', name: 'Alternativ leverandørkortlægning for køletransport', category: catContinuity, orgUnitId: orgFoodservice.id, type: ControlType.COMPENSATING, frequency: ControlFrequency.ANNUAL, frameworkControlKeys: ['nis21'] },
    { code: 'CTL-015', name: 'Adgangskontrol (ID-kort) til lagerfaciliteter', category: catAccess, orgUnitId: orgLogistik.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.CONTINUOUS, frameworkControlKeys: ['iso7.2'] },
    { code: 'CTL-016', name: 'Brandsikringssystem i serverrum', category: catContinuity, orgUnitId: orgAps.id, type: ControlType.PREVENTIVE, frequency: ControlFrequency.ANNUAL, frameworkControlKeys: ['iso7.5'] },
    { code: 'CTL-017', name: 'Besøgsregistrering og eskortepolitik', category: catAccess, orgUnitId: orgAps.id, type: ControlType.DETECTIVE, frequency: ControlFrequency.CONTINUOUS, frameworkControlKeys: ['iso7.2'] },
  ];

  const controls: Record<string, Awaited<ReturnType<typeof prisma.control.create>>> = {};
  for (const seed of controlSeeds) {
    let control = await prisma.control.findUnique({ where: { code: seed.code } });
    if (!control) {
      control = await prisma.control.create({
        data: {
          code: seed.code,
          name: seed.name,
          domainCategoryId: seed.category.id,
          nistCsfFunction: seed.nistCsfFunction,
          orgUnitId: seed.orgUnitId,
          type: seed.type,
          frequency: seed.frequency,
          frameworkControlLinks: {
            create: seed.frameworkControlKeys.map((key) => ({ frameworkControlId: frameworkControls[key].id })),
          },
        },
      });
    }
    controls[seed.code] = control;
  }

  // ---------------------------------------------------------------------
  // Control Tests (+ one sample evidence file)
  // ---------------------------------------------------------------------
  const testers = [auditor, admin, riskOwnerAps, riskOwnerLogistik, riskOwnerFoodservice];

  interface ControlTestSeed {
    controlCode: string;
    result: TestResult;
    testMethod: TestMethod;
    testerId: string;
    cycle: string;
    testedOffsetDays: number;
    dueOffsetDays: number;
    exceptionNotes?: string;
    withSampleEvidence?: boolean;
  }

  const controlTestSeeds: ControlTestSeed[] = [
    { controlCode: 'CTL-001', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: auditor.id, cycle: 'Q2 2026', testedOffsetDays: -100, dueOffsetDays: -10 },
    { controlCode: 'CTL-001', result: TestResult.PASS, testMethod: TestMethod.REPERFORMANCE, testerId: auditor.id, cycle: 'Q3 2026', testedOffsetDays: -10, dueOffsetDays: 80 },
    { controlCode: 'CTL-002', result: TestResult.PARTIAL, testMethod: TestMethod.AUTOMATED, testerId: admin.id, cycle: 'Q2 2026', testedOffsetDays: -80, exceptionNotes: 'To servere manglede seneste scanningsagent - afhjulpet efterfølgende.', dueOffsetDays: 10 },
    { controlCode: 'CTL-003', result: TestResult.FAIL, testMethod: TestMethod.INSPECTION, testerId: riskOwnerLogistik.id, cycle: 'Q3 2026', testedOffsetDays: -15, exceptionNotes: 'Kritiske sikkerhedsopdateringer manglede på 4 ud af 12 servere ved test. Afhjælpningsplan igangsat med frist 30 dage.', dueOffsetDays: 15, withSampleEvidence: true },
    { controlCode: 'CTL-004', result: TestResult.PASS, testMethod: TestMethod.WALKTHROUGH, testerId: auditor.id, cycle: '2025', testedOffsetDays: -200, dueOffsetDays: 165 },
    { controlCode: 'CTL-005', result: TestResult.PASS, testMethod: TestMethod.AUTOMATED, testerId: riskOwnerFoodservice.id, cycle: 'Q3 2026', testedOffsetDays: -5, dueOffsetDays: 85 },
    { controlCode: 'CTL-018', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: riskOwnerAps.id, cycle: 'Uge 35 2026', testedOffsetDays: -3, dueOffsetDays: 4 },
    { controlCode: 'CTL-006', result: TestResult.PASS, testMethod: TestMethod.AUTOMATED, testerId: riskOwnerFoodservice.id, cycle: 'Q3 2026', testedOffsetDays: -20, dueOffsetDays: 70 },
    { controlCode: 'CTL-007', result: TestResult.PARTIAL, testMethod: TestMethod.INSPECTION, testerId: auditor.id, cycle: 'Q2 2026', testedOffsetDays: -60, exceptionNotes: 'Enkelte forældede brugerkonti fundet ved rettighedsgennemgang - lukket efterfølgende.', dueOffsetDays: 30 },
    { controlCode: 'CTL-008', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: auditor.id, cycle: 'Q3 2026', testedOffsetDays: -12, dueOffsetDays: 78 },
    { controlCode: 'CTL-009', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: riskOwnerFoodservice.id, cycle: '2026', testedOffsetDays: -40, dueOffsetDays: 325 },
    { controlCode: 'CTL-010', result: TestResult.PARTIAL, testMethod: TestMethod.WALKTHROUGH, testerId: admin.id, cycle: '2026', testedOffsetDays: -25, exceptionNotes: 'Governance-proces defineret men mangler formel godkendelse fra direktionen.', dueOffsetDays: 340 },
    { controlCode: 'CTL-012', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: riskOwnerLogistik.id, cycle: '2025', testedOffsetDays: -150, dueOffsetDays: 215 },
    { controlCode: 'CTL-013', result: TestResult.FAIL, testMethod: TestMethod.WALKTHROUGH, testerId: riskOwnerLogistik.id, cycle: '2026', testedOffsetDays: -8, exceptionNotes: 'Nøgleleverandørs beredskabsplan er udløbet og ikke fornyet - se relaterede Risk og Treatment Action.', dueOffsetDays: 357 },
    { controlCode: 'CTL-015', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: auditor.id, cycle: 'Q3 2026', testedOffsetDays: -18, dueOffsetDays: 72 },
    { controlCode: 'CTL-016', result: TestResult.PASS, testMethod: TestMethod.INSPECTION, testerId: riskOwnerAps.id, cycle: '2026', testedOffsetDays: -50, dueOffsetDays: 315 },
    { controlCode: 'CTL-017', result: TestResult.PARTIAL, testMethod: TestMethod.WALKTHROUGH, testerId: auditor.id, cycle: 'Q3 2026', testedOffsetDays: -6, exceptionNotes: 'Stikprøve viste enkelte besøgende uden korrekt registrering.', dueOffsetDays: 84 },
  ];

  const evidenceDir = process.env.EVIDENCE_STORAGE_DIR || path.join(__dirname, '..', 'data', 'evidence');
  const sampleControlTestDir = path.join(evidenceDir, 'seed-sample');
  fs.mkdirSync(sampleControlTestDir, { recursive: true });
  const sampleEvidenceFilename = 'CTL-003-patch-status-report.txt';
  const sampleEvidenceContent =
    'DagrofaShield - Sample evidence file (seed data)\n\n' +
    'Control: CTL-003 - Patch management for serverinfrastruktur\n' +
    'Finding: 4 of 12 servers missing critical security patches at time of test.\n' +
    'This is placeholder seed evidence for demo purposes only.\n';

  for (const seed of controlTestSeeds) {
    const control = controls[seed.controlCode];
    const existing = await prisma.controlTest.findFirst({
      where: { controlId: control.id, cycle: seed.cycle },
    });
    if (existing) continue;

    const test = await prisma.controlTest.create({
      data: {
        controlId: control.id,
        result: seed.result,
        testMethod: seed.testMethod,
        testerId: seed.testerId,
        cycle: seed.cycle,
        testedDate: daysFromNow(seed.testedOffsetDays),
        dueDate: daysFromNow(seed.dueOffsetDays),
        exceptionNotes: seed.exceptionNotes,
      },
    });

    if (seed.withSampleEvidence) {
      const testEvidenceDir = path.join(evidenceDir, test.id);
      fs.mkdirSync(testEvidenceDir, { recursive: true });
      const storedFilename = `seed-${sampleEvidenceFilename}`;
      fs.writeFileSync(path.join(testEvidenceDir, storedFilename), sampleEvidenceContent, 'utf-8');
      await prisma.evidence.create({
        data: {
          controlTestId: test.id,
          filename: sampleEvidenceFilename,
          storagePath: path.join(test.id, storedFilename),
          mimeType: 'text/plain',
          sizeBytes: Buffer.byteLength(sampleEvidenceContent, 'utf-8'),
          uploadedById: seed.testerId,
        },
      });
    }
  }

  // Recompute each Control's denormalized effectiveness/lastTestedAt from its
  // latest test, mirroring ControlsService.recomputeFromLatestTest (the
  // seed script writes directly via Prisma, bypassing the service layer).
  for (const control of Object.values(controls)) {
    const latest = await prisma.controlTest.findFirst({
      where: { controlId: control.id },
      orderBy: { testedDate: 'desc' },
    });
    const effectiveness = !latest
      ? ControlEffectiveness.NOT_YET_TESTED
      : latest.result === TestResult.PASS
        ? ControlEffectiveness.EFFECTIVE
        : latest.result === TestResult.PARTIAL
          ? ControlEffectiveness.PARTIALLY_EFFECTIVE
          : ControlEffectiveness.INEFFECTIVE;
    await prisma.control.update({
      where: { id: control.id },
      data: { effectiveness, lastTestedAt: latest?.testedDate ?? null },
    });
  }

  // ---------------------------------------------------------------------
  // Risk <-> Control links (RiskControl) - demonstrates the propagation
  // engine: each linked Control's current effectiveness feeds the linked
  // Risk's computed residual score below.
  // ---------------------------------------------------------------------
  const riskControlLinkSeeds: { riskKey: string; controlCode: string }[] = [
    { riskKey: 'mfa', controlCode: 'CTL-001' },
    { riskKey: 'firmware', controlCode: 'CTL-003' },
    { riskKey: 'kryptering', controlCode: 'CTL-006' },
    { riskKey: 'logging', controlCode: 'CTL-008' },
    { riskKey: 'leverandoer-beredskab', controlCode: 'CTL-013' },
    { riskKey: 'phishing', controlCode: 'CTL-005' },
  ];
  for (const link of riskControlLinkSeeds) {
    await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId: risks[link.riskKey].id, controlId: controls[link.controlCode].id } },
      update: {},
      create: { riskId: risks[link.riskKey].id, controlId: controls[link.controlCode].id },
    });
  }

  // Recompute residualScore/residualBand/residualSource for every risk,
  // mirroring ResidualScoringService (the seed script writes directly via
  // Prisma, bypassing the service layer): a manual override wins, otherwise
  // it's derived from currently linked Controls' effectiveness.
  const residualStrategy = new ControlBasedResidualScoringStrategy();
  for (const risk of Object.values(risks)) {
    const links = await prisma.riskControl.findMany({
      where: { riskId: risk.id },
      include: { control: { select: { effectiveness: true } } },
    });
    const computed = residualStrategy.computeResidualScore(
      risk.inherentScore,
      links.map((l) => l.control.effectiveness),
    );
    const residualScore = risk.residualScoreOverride ?? computed;
    await prisma.risk.update({
      where: { id: risk.id },
      data: {
        residualScore,
        residualBand: residualScore != null ? scoreToBand(residualScore) : null,
        residualSource: risk.residualScoreOverride != null ? 'MANUAL' : computed != null ? 'COMPUTED' : null,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Business Impact Analysis (BIA) Register
  // ---------------------------------------------------------------------
  interface BusinessProcessSeed {
    key: string;
    name: string;
    description: string;
    orgUnitId: string;
    ownerId: string;
    criticalityTier: BusinessProcessCriticalityTier;
    rtoMinutes?: number;
    rpoMinutes?: number;
    // CIA triad rating (1-3: Low/Medium/High) - independent of criticalityTier.
    confidentialityScore: number;
    integrityScore: number;
    availabilityScore: number;
    riskKeys: string[];
    // Other seeded processes (by key) this one depends on - linked in a
    // second pass below, once every process has been created.
    dependsOnKeys?: string[];
  }

  const businessProcessSeeds: BusinessProcessSeed[] = [
    {
      key: 'lagerstyring',
      name: 'Lagerstyring og pluk',
      description: 'Modtagelse, lagerstyring og plukning af varer på de automatiserede lagre.',
      orgUnitId: orgLogistik.id,
      ownerId: riskOwnerLogistik.id,
      criticalityTier: BusinessProcessCriticalityTier.CRITICAL,
      rtoMinutes: 240,
      rpoMinutes: 60,
      confidentialityScore: 1,
      integrityScore: 2,
      availabilityScore: 3,
      riskKeys: ['firmware', 'ot-it-segmentering', 'adgangskontrol-lager'],
    },
    {
      key: 'koeletransport',
      name: 'Kølet transport til Foodservice-kunder',
      description: 'Distribution af kølede og frosne varer til Foodservice-kunder.',
      orgUnitId: orgFoodservice.id,
      ownerId: riskOwnerFoodservice.id,
      criticalityTier: BusinessProcessCriticalityTier.CRITICAL,
      rtoMinutes: 120,
      rpoMinutes: 30,
      confidentialityScore: 1,
      integrityScore: 1,
      availabilityScore: 3,
      riskKeys: ['koeletransport', 'leverandoer-beredskab'],
      // Cold transport can't dispatch orders that haven't been picked yet.
      dependsOnKeys: ['lagerstyring'],
    },
    {
      key: 'kundedata',
      name: 'Kundedatabehandling',
      description: 'Behandling og opbevaring af persondata om kunder på tværs af koncernens systemer.',
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      criticalityTier: BusinessProcessCriticalityTier.HIGH,
      rtoMinutes: 480,
      rpoMinutes: 240,
      confidentialityScore: 3,
      integrityScore: 2,
      availabilityScore: 2,
      riskKeys: ['logging', 'gdpr-deling'],
    },
    {
      key: 'besoegshaandtering',
      name: 'Besøgshåndtering på hovedkontor',
      description: 'Registrering og eskorte af eksterne besøgende på hovedkontoret.',
      orgUnitId: orgAps.id,
      ownerId: riskOwnerAps.id,
      criticalityTier: BusinessProcessCriticalityTier.LOW,
      confidentialityScore: 1,
      integrityScore: 1,
      availabilityScore: 1,
      riskKeys: ['besoegsregistrering'],
    },
  ];

  const businessProcesses: Record<string, Awaited<ReturnType<typeof prisma.businessProcess.create>>> = {};
  for (const seed of businessProcessSeeds) {
    const existing = await prisma.businessProcess.findFirst({ where: { name: seed.name } });
    const process =
      existing ??
      (await prisma.businessProcess.create({
        data: {
          name: seed.name,
          description: seed.description,
          orgUnitId: seed.orgUnitId,
          ownerId: seed.ownerId,
          criticalityTier: seed.criticalityTier,
          rtoMinutes: seed.rtoMinutes,
          rpoMinutes: seed.rpoMinutes,
          confidentialityScore: seed.confidentialityScore,
          integrityScore: seed.integrityScore,
          availabilityScore: seed.availabilityScore,
        },
      }));
    businessProcesses[seed.key] = process;
    for (const riskKey of seed.riskKeys) {
      await prisma.businessProcessRisk.upsert({
        where: { businessProcessId_riskId: { businessProcessId: process.id, riskId: risks[riskKey].id } },
        update: {},
        create: { businessProcessId: process.id, riskId: risks[riskKey].id },
      });
    }
  }

  // Second pass: link Business Process dependencies (dependsOnKeys) now
  // that every process has been created.
  for (const seed of businessProcessSeeds) {
    for (const dependsOnKey of seed.dependsOnKeys ?? []) {
      await prisma.businessProcessDependency.upsert({
        where: {
          businessProcessId_dependsOnId: {
            businessProcessId: businessProcesses[seed.key].id,
            dependsOnId: businessProcesses[dependsOnKey].id,
          },
        },
        update: {},
        create: {
          businessProcessId: businessProcesses[seed.key].id,
          dependsOnId: businessProcesses[dependsOnKey].id,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`Seeded local accounts (password: "${SEED_PASSWORD}" - rotate before real use):`);
  for (const u of [admin, riskOwnerAps, riskOwnerLogistik, riskOwnerFoodservice, auditor, executive]) {
    console.log(`  - ${u.email} (${u.role})`);
  }
  console.log(`  - ${invitedRiskOwner.email} (${invitedRiskOwner.role}) - Invited, no password, never logged in`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
