export const GLOSSARY_THEMES = {
  marches: "Marchés publics",
  etat: "Budget et subventions de l'État",
  communes: "Finances des communes",
  organisations: "Organisations et identifiants",
  lecture: "Lire les chiffres",
} as const;

interface GlossaryEntry {
  term: string;
  theme: keyof typeof GLOSSARY_THEMES;
  definition: string;
}

export const GLOSSARY = {
  "circonscription-legislative": {
    term: "Circonscription législative",
    theme: "lecture",
    definition:
      "Territoire qui élit un député à l’Assemblée nationale. Une commune peut appartenir à plusieurs circonscriptions ; connaître la commune ne suffit alors pas à identifier un seul député.",
  },
  "fonction-budgetaire": {
    term: "Fonction budgétaire",
    theme: "communes",
    definition:
      "Classement des dépenses selon le service rendu (enseignement, sport, voirie…), au lieu de leur nature comptable (salaires, achats…). Les communes ne publient pas toutes cette ventilation. Les nomenclatures M14 et M57 classent certains services différemment.",
  },
  "groupe-entreprises": {
    term: "Groupe d'entreprises",
    theme: "organisations",
    definition:
      "Ensemble constitué d'une société mère et des sociétés qu'elle contrôle. Chaque société conserve son propre SIREN. Un périmètre partiel et daté ne représente pas nécessairement toutes les sociétés du groupe aujourd'hui.",
  },
  "million-milliard": {
    term: "Million et milliard d’euros",
    theme: "lecture",
    definition:
      "1 M€ vaut un million d’euros. 1 Md€ vaut un milliard d’euros, soit 1 000 millions.",
  },
  cnccfp: {
    term: "CNCCFP",
    theme: "lecture",
    definition:
      "Commission nationale des comptes de campagne et des financements politiques. Elle contrôle les comptes des candidats et des partis ; ses décisions administratives ne sont pas des condamnations pénales.",
  },
  hatvp: {
    term: "HATVP",
    theme: "lecture",
    definition:
      "Haute Autorité pour la transparence de la vie publique. Elle contrôle notamment les déclarations d’intérêts des responsables publics et tient le registre des représentants d’intérêts.",
  },
  "participation-scrutins": {
    term: "Participation aux scrutins publics",
    theme: "lecture",
    definition:
      "Votes pour, contre et abstentions enregistrés, délégations incluses, divisés par les scrutins publics publiés pendant le mandat. Ce taux ne mesure ni la présence physique ni tout le travail parlementaire.",
  },
  "declaration-interets": {
    term: "Déclaration d'intérêts et d'activités",
    theme: "lecture",
    definition:
      "Déclaration publique des activités, mandats et intérêts de la personne dans son rôle public. Elle ne constitue pas une déclaration de patrimoine ni un relevé des dépenses publiques.",
  },
  "compte-campagne": {
    term: "Compte de campagne",
    theme: "lecture",
    definition:
      "Recettes et dépenses liées à une élection, contrôlées par la CNCCFP. Les montants déclarés peuvent être réformés. Un remboursement fixé par la commission ne prouve pas son paiement.",
  },
  "enveloppe-frais": {
    term: "Enveloppe de frais de mandat",
    theme: "lecture",
    definition:
      "Moyens autorisés pour couvrir les frais liés au mandat. Ce montant n'est ni le revenu personnel ni la consommation réelle de la personne.",
  },
  "base-fiscale": {
    term: "Base fiscale",
    theme: "communes",
    definition:
      "Valeur utilisée pour calculer l’impôt avant application du taux, notamment la valeur locative cadastrale après exonérations. Elle diffère de la valeur de marché des biens.",
  },
  "foyer-fiscal": {
    term: "Foyer fiscal",
    theme: "communes",
    definition:
      "Ensemble des personnes figurant sur une même déclaration de revenus. Un foyer fiscal n’est pas nécessairement un ménage au sens du recensement.",
  },
  "revenu-fiscal-reference": {
    term: "Revenu fiscal de référence",
    theme: "communes",
    definition:
      "Montant calculé par l’administration fiscale à partir des revenus déclarés, avec réintégration de certains revenus exonérés ou abattements. Il est distinct du revenu disponible.",
  },
  "participation-electorale": {
    term: "Participation électorale",
    theme: "lecture",
    definition:
      "Nombre de votants, votes blancs et nuls inclus, divisé par le nombre d’inscrits. Au second tour, seuls les électeurs appelés à voter sont comptés.",
  },
  cpv: {
    term: "Code CPV",
    theme: "marches",
    definition:
      "Nomenclature européenne des objets d’achat public. Les deux premiers chiffres désignent une grande famille d’achats. Ce code décrit le marché, pas le secteur d’activité de son titulaire.",
  },
  plf: {
    term: "Projet de loi de finances (PLF)",
    theme: "etat",
    definition:
      "Texte proposé pour autoriser les recettes et les dépenses de l’État pour un exercice. Son examen parlementaire ne prouve pas que les dépenses ont été réalisées.",
  },
  plfss: {
    term: "Projet de loi de financement de la sécurité sociale (PLFSS)",
    theme: "etat",
    definition:
      "Texte proposé fixant notamment les conditions de l’équilibre financier de la sécurité sociale et ses objectifs de dépenses. Il ne décrit pas les paiements effectivement réalisés.",
  },
  "journal-officiel": {
    term: "Journal officiel",
    theme: "lecture",
    definition:
      "Publication officielle des lois, décrets, arrêtés et autres actes. La date de publication diffère de la date de signature. La version initiale peut avoir été modifiée depuis.",
  },
  navette: {
    term: "Navette parlementaire",
    theme: "lecture",
    definition:
      "Examen successif d’un projet ou d’une proposition de loi par l’Assemblée nationale et le Sénat, jusqu’à l’adoption d’un texte selon la procédure applicable.",
  },
  lobbying: {
    term: "Représentation d’intérêts",
    theme: "organisations",
    definition:
      "Actions visant à influencer une décision publique, déclarées aux registres français et européen selon des périmètres différents. Une fiche peut regrouper plusieurs actions.",
  },
  "aide-partis": {
    term: "Aide publique aux partis",
    theme: "etat",
    definition:
      "Financement public des partis, encadré par la loi du 11 mars 1988, en deux fractions et autres aides. Une aide comptabilisée n’atteste pas un versement direct de l’État la même année.",
  },
  "non-affectation": {
    term: "Universalité budgétaire et non-affectation",
    theme: "etat",
    definition:
      "En principe, les recettes de l’État financent ensemble ses dépenses, sans réserver chaque impôt à un usage. La loi prévoit des exceptions : taxes affectées, comptes spéciaux et fonds de concours.",
  },
  "branche-securite-sociale": {
    term: "Branche de la Sécurité sociale",
    theme: "etat",
    definition:
      "Régimes de base couvrant la maladie, la vieillesse, la famille, les accidents du travail et maladies professionnelles ou l’autonomie, régis par les lois de financement de la Sécurité sociale (LFSS). Le chômage et les retraites complémentaires sont exclus.",
  },
  ondam: {
    term: "ONDAM",
    theme: "etat",
    definition:
      "Objectif national de dépenses d’assurance maladie, voté par le Parlement. Il couvre des soins de ville, des établissements de santé et des services médico-sociaux, sur plusieurs branches, sans couvrir toutes leurs dépenses.",
  },
  "titre-budgetaire": {
    term: "Titre budgétaire",
    theme: "etat",
    definition:
      "Classe les dépenses de l’État par nature : personnel, fonctionnement, dette, investissement, intervention et opérations financières. Une mission indique leur objectif.",
  },
  "actif-etat": {
    term: "Actif de l’État",
    theme: "etat",
    definition:
      "Valeur comptable des biens, participations, créances et disponibilités de l’État à la date du bilan.",
  },
  "passif-etat": {
    term: "Passif de l’État",
    theme: "etat",
    definition:
      "Dettes et obligations inscrites au bilan de l’État, y compris provisions et dettes non financières. Les engagements hors bilan sont présentés à part.",
  },
  "situation-nette": {
    term: "Situation nette",
    theme: "etat",
    definition:
      "Différence entre l’actif et le passif inscrits au bilan. Une valeur négative signifie que le passif comptabilisé dépasse l’actif. Le pouvoir de lever l’impôt ne constitue pas un actif comptable.",
  },
  "prelevements-obligatoires": {
    term: "Prélèvements obligatoires",
    theme: "etat",
    definition:
      "Impôts et cotisations sociales effectives reçus par les administrations publiques et les institutions européennes, nets des crédits d’impôt et montants non recouvrables, selon les comptes nationaux.",
  },
  "budget-vert": {
    term: "Budget vert",
    theme: "etat",
    definition:
      "Classe les dépenses selon leur effet sur six objectifs environnementaux. Une dépense mixte combine des effets favorables et défavorables. Une dépense non cotée n’a pas pu être évaluée.",
  },
  pib: {
    term: "Produit intérieur brut (PIB)",
    theme: "lecture",
    definition:
      "Valeur des biens et services produits sur un territoire pendant une année. Rapporter un montant au PIB permet de le comparer à la taille de l’économie.",
  },
  "dette-publique": {
    term: "Dette publique au sens de Maastricht",
    theme: "etat",
    definition:
      "Total restant à rembourser par les administrations publiques à une date donnée, sans compter leurs dettes entre elles. Le déficit mesure l’écart annuel entre dépenses et recettes.",
  },
  perequation: {
    term: "Péréquation",
    theme: "communes",
    definition:
      "Mécanismes redistribuant des ressources entre collectivités afin de réduire les écarts. La péréquation horizontale passe entre collectivités ; la péréquation verticale passe par les dotations de l’État.",
  },
  "cotisations-sociales": {
    term: "Cotisations sociales",
    theme: "lecture",
    definition:
      "Versements des employeurs, des salariés et des travailleurs indépendants qui ouvrent des droits à des prestations de protection sociale.",
  },
  "prestations-sociales": {
    term: "Prestations sociales",
    theme: "lecture",
    definition:
      "Aides en espèces ou en nature destinées aux ménages pour couvrir des besoins comme la maladie, la vieillesse, la famille ou le chômage.",
  },
  odac: {
    term: "Organismes divers d'administration centrale (ODAC)",
    theme: "etat",
    definition:
      "Organismes auxquels l'État confie une mission spécialisée au niveau national, selon le périmètre de la comptabilité nationale, distinct de celui des opérateurs budgétaires.",
  },
  "marche-public": {
    term: "Marché public",
    theme: "marches",
    definition:
      "Contrat par lequel un acheteur public achète des travaux, des fournitures ou des services à une entreprise ou à un organisme, après une mise en concurrence.",
  },
  "acheteur-public": {
    term: "Acheteur public",
    theme: "marches",
    definition:
      "Organisme public qui passe un marché : ministère, collectivité, hôpital, établissement public…",
  },
  titulaire: {
    term: "Titulaire",
    theme: "marches",
    definition:
      "Entreprise ou organisme qui a remporté un marché public et doit l'exécuter. Un marché peut avoir plusieurs titulaires.",
  },
  "montant-marche": {
    term: "Montant d'un marché",
    theme: "marches",
    definition:
      "Somme prévue au contrat, hors taxes. Ce n'est pas un paiement : pour un accord-cadre, c'est souvent un plafond, et la somme réellement payée peut être plus faible.",
  },
  "accord-cadre": {
    term: "Accord-cadre",
    theme: "marches",
    definition:
      "Marché qui fixe les règles, et souvent un montant maximal, pour des commandes passées au fil des besoins pendant plusieurs années.",
  },
  notification: {
    term: "Notification",
    theme: "marches",
    definition:
      "Date à laquelle l'acheteur informe le titulaire qu'il a remporté le marché. Les marchés de 40 000 € HT ou plus doivent être publiés dans les deux mois qui suivent.",
  },
  decp: {
    term: "Données essentielles de la commande publique (DECP)",
    theme: "marches",
    definition:
      "Informations que chaque acheteur public doit publier sur ses marchés (objet, montant, titulaire, date), rassemblées dans un fichier national ouvert.",
  },
  subvention: {
    term: "Subvention",
    theme: "etat",
    definition:
      "Aide financière versée à un organisme, souvent une association, pour une action d'intérêt général. Contrairement à un marché, l'organisme ne vend rien en échange.",
  },
  "jaune-associations": {
    term: "Annexe «\u00a0Jaune\u00a0» associations",
    theme: "etat",
    definition:
      "Document joint chaque année au projet de loi de finances. Il liste les versements de l'État aux associations deux ans plus tôt : subventions, prestations de services et autres crédits.",
  },
  "budget-general": {
    term: "Budget général",
    theme: "etat",
    definition:
      "Principal budget de l'État, qui regroupe l'essentiel de ses dépenses. Il ne comprend ni la Sécurité sociale ni les budgets des collectivités.",
  },
  mission: {
    term: "Mission",
    theme: "etat",
    definition:
      "Grande politique publique du budget de l'État, par exemple la Défense ou l'Enseignement scolaire. Le Parlement vote les crédits mission par mission.",
  },
  programme: {
    term: "Programme",
    theme: "etat",
    definition:
      "Subdivision d'une mission, confiée à un ministère, avec ses propres objectifs. Les subventions de l'État sont classées par programme.",
  },
  "credits-paiement": {
    term: "Crédits de paiement",
    theme: "etat",
    definition:
      "Sommes que l'État est autorisé à payer pendant l'année. Les crédits votés sont distincts des crédits consommés, qui correspondent aux dépenses exécutées.",
  },
  "loi-de-finances": {
    term: "Loi de finances initiale (LFI)",
    theme: "etat",
    definition:
      "Loi votée chaque année par le Parlement. Elle autorise les recettes et les dépenses de l'État pour l'année suivante.",
  },
  "resultats-gestion": {
    term: "Loi relative aux résultats de la gestion",
    theme: "etat",
    definition:
      "Loi votée après la fin de l'année qui constate ce que l'État a réellement dépensé et approuve ses comptes. Elle a remplacé la loi de règlement.",
  },
  "remboursements-degrevements": {
    term: "Remboursements et dégrèvements",
    theme: "etat",
    definition:
      "Mission du budget qui correspond surtout à des impôts rendus ou annulés : trop-perçus remboursés, crédits d'impôt, allègements accordés aux contribuables et aux entreprises.",
  },
  "prelevements-sur-recettes": {
    term: "Prélèvements sur recettes",
    theme: "etat",
    definition:
      "Part des recettes de l'État reversée directement, avant toute dépense, aux collectivités territoriales et au budget de l'Union européenne.",
  },
  "fonds-de-concours": {
    term: "Fonds de concours",
    theme: "etat",
    definition:
      "Sommes versées à l'État par d'autres organismes (collectivités, Union européenne, entreprises…) pour financer une dépense précise.",
  },
  deficit: {
    term: "Déficit",
    theme: "etat",
    definition:
      "Dépenses qui dépassent les recettes d'une administration sur une année ; cet écart constitue un besoin de financement.",
  },
  "comptabilite-nationale": {
    term: "Comptabilité nationale",
    theme: "etat",
    definition:
      "Comptes de l'ensemble de l'économie, établis par l'Insee selon des règles européennes communes. L'État y est mesuré sur un périmètre différent du budget général.",
  },
  "administrations-publiques": {
    term: "Administrations publiques",
    theme: "etat",
    definition:
      "L'État, ses opérateurs (universités, agences…), les collectivités locales et la Sécurité sociale.",
  },
  "depenses-consolidees": {
    term: "Dépenses consolidées",
    theme: "etat",
    definition:
      "Dépenses de plusieurs administrations additionnées sans compter deux fois l'argent qu'elles se versent entre elles, par exemple la dotation de l'État aux communes.",
  },
  menage: {
    term: "Ménage",
    theme: "etat",
    definition:
      "Ensemble des personnes qui vivent dans un même logement, au sens de l'Insee. La France compte environ 31 millions de ménages.",
  },
  strate: {
    term: "Strate de population",
    theme: "communes",
    definition:
      "Groupe de communes de taille proche, par exemple de 10 000 à 19 999 habitants. Comparer une commune à sa strate évite de comparer un village à une grande ville.",
  },
  "depenses-totales": {
    term: "Dépenses totales",
    theme: "communes",
    definition:
      "Dépenses de fonctionnement et d'investissement d'une commune, sans le remboursement du capital de sa dette.",
  },
  fonctionnement: {
    term: "Dépenses de fonctionnement",
    theme: "communes",
    definition:
      "Dépenses courantes qui reviennent chaque année : salaires, achats, entretien, aides versées, intérêts de la dette.",
  },
  investissement: {
    term: "Dépenses d'investissement",
    theme: "communes",
    definition:
      "Dépenses qui enrichissent durablement le patrimoine de la commune : construction d'une école, travaux de voirie, équipements.",
  },
  "epargne-brute": {
    term: "Épargne brute",
    theme: "communes",
    definition:
      "Ce qui reste des recettes de fonctionnement une fois les dépenses de fonctionnement payées. Elle sert à rembourser la dette et à investir.",
  },
  dette: {
    term: "Encours de la dette",
    theme: "communes",
    definition: "Total de ce que la commune doit encore rembourser à ses prêteurs au 31 décembre.",
  },
  dgf: {
    term: "Dotation globale de fonctionnement (DGF)",
    theme: "communes",
    definition:
      "Principale somme versée chaque année par l'État aux collectivités pour financer leur fonctionnement.",
  },
  "impots-locaux": {
    term: "Impôts locaux",
    theme: "communes",
    definition:
      "Impôts perçus par la commune, surtout la taxe foncière et la taxe d'habitation sur les résidences secondaires.",
  },
  intercommunalite: {
    term: "Intercommunalité",
    theme: "communes",
    definition:
      "Groupement de communes (communauté de communes, d'agglomération, métropole) qui exerce certaines compétences à leur place, comme les déchets ou les transports. Ses dépenses ne figurent pas dans les comptes des communes.",
  },
  "budget-annexe": {
    term: "Budget annexe",
    theme: "communes",
    definition:
      "Budget séparé pour un service particulier, souvent l'eau, l'assainissement ou les transports. Les chiffres de ce site l'incluent.",
  },
  "comptes-consolides": {
    term: "Comptes consolidés",
    theme: "communes",
    definition:
      "Comptes qui additionnent le budget principal et les budgets annexes, sans les flux entre eux, pour ne pas compter deux fois la même somme.",
  },
  "commune-nouvelle": {
    term: "Commune nouvelle",
    theme: "communes",
    definition:
      "Commune née de la fusion de plusieurs communes. Pour les années avant la fusion, ce site additionne les comptes des anciennes communes.",
  },
  siren: {
    term: "SIREN",
    theme: "organisations",
    definition:
      "Numéro à 9 chiffres qui identifie une entreprise, une association ou un organisme public dans le répertoire Sirene de l'Insee.",
  },
  sirene: {
    term: "Répertoire Sirene",
    theme: "organisations",
    definition:
      "Registre national tenu par l'Insee des entreprises, associations et administrations, avec leur nom, leur catégorie juridique et leur activité.",
  },
  "categorie-juridique": {
    term: "Catégorie juridique",
    theme: "organisations",
    definition:
      "Forme de l'organisation selon l'Insee : association, société commerciale, collectivité territoriale, établissement public…",
  },
  "entrepreneur-individuel": {
    term: "Entrepreneur individuel",
    theme: "organisations",
    definition:
      "Personne qui exerce une activité en son nom propre, sans créer de société. Comme il s'agit d'une personne physique, son nom et son numéro ne sont jamais affichés ici.",
  },
  "code-insee": {
    term: "Code Insee",
    theme: "organisations",
    definition:
      "Code à 5 caractères qui identifie chaque commune, par exemple 69123 pour Lyon. À ne pas confondre avec le code postal.",
  },
  "par-habitant": {
    term: "Par habitant",
    theme: "lecture",
    definition:
      "Montant divisé par la population totale de la commune. Cela permet de comparer des communes de tailles différentes.",
  },
  mediane: {
    term: "Médiane",
    theme: "lecture",
    definition:
      "Valeur du milieu : la moitié des communes est au-dessus, l'autre moitié en dessous. Contrairement à la moyenne, elle n'est pas tirée par quelques valeurs extrêmes.",
  },
  "donnees-ouvertes": {
    term: "Données ouvertes",
    theme: "lecture",
    definition:
      "Données publiées par l'administration et librement réutilisables par tous. Tous les chiffres de ce site en proviennent.",
  },
  "licence-ouverte": {
    term: "Licence Ouverte",
    theme: "lecture",
    definition:
      "Licence de l'État qui autorise à réutiliser des données publiques, y compris à des fins commerciales, à condition de citer la source.",
  },
  mcp: {
    term: "MCP (Model Context Protocol)",
    theme: "lecture",
    definition:
      "Norme ouverte qui permet à un assistant d'IA comme Claude ou ChatGPT d'interroger un service. Le serveur MCP de Chaque Euro donne accès aux mêmes données que le site, en lecture seule.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type TermId = keyof typeof GLOSSARY;
