import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { AssociationCsvImportForm } from '@/features/associations/components/AssociationCsvImportForm';
import { requirePlatformAdmin } from '@/lib/auth';

type AdminCsvPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

const adminPageCopy = {
  en: {
    chooseFile: 'Choose CSV file',
    csvDescription: 'Use the Layer 1 directory schema. Valid rows import even if other rows are rejected.',
    csvDrop: 'Drop a CSV, or browse',
    downloadTemplate: 'Download template',
    importCsv: 'Import CSV',
    importRows: 'Import rows',
    preview: 'Import results',
    resultImported: 'imported',
    resultSkipped: 'skipped',
    resultsTitle: 'Select a CSV file, then import to see per-row results.',
    errors: {
      'KMG-CSV-OK': 'Imported',
      'KMG-CSV-001': 'CSV file is empty or invalid',
      'KMG-CSV-002': 'Missing official name, city, or postal code',
      'KMG-CSV-003': 'CSV file must be 1 MB or smaller',
      'KMG-CSV-004': 'Invalid language or registry type',
      'KMG-CSV-409': 'Registry number already exists',
      'KMG-SYS-000': 'Import failed'
    }
  },
  fr: {
    chooseFile: 'Choisir le CSV',
    csvDescription: 'Utilisez le sch\u00e9ma de l\u2019annuaire Layer 1. Les lignes valides sont import\u00e9es m\u00eame si d\u2019autres lignes sont rejet\u00e9es.',
    csvDrop: 'D\u00e9poser un CSV ou parcourir',
    downloadTemplate: 'T\u00e9l\u00e9charger le mod\u00e8le',
    importCsv: 'Importer CSV',
    importRows: 'Importer les lignes',
    preview: 'R\u00e9sultats d\u2019import',
    resultImported: 'import\u00e9es',
    resultSkipped: 'rejet\u00e9es',
    resultsTitle: 'S\u00e9lectionnez un fichier CSV, puis importez-le pour voir les r\u00e9sultats par ligne.',
    errors: {
      'KMG-CSV-OK': 'Import\u00e9e',
      'KMG-CSV-001': 'Le fichier CSV est vide ou invalide',
      'KMG-CSV-002': 'Nom officiel, ville ou code postal manquant',
      'KMG-CSV-003': 'Le fichier CSV doit peser 1 Mo ou moins',
      'KMG-CSV-004': 'Langue ou type de registre invalide',
      'KMG-CSV-409': 'Le num\u00e9ro de registre existe d\u00e9j\u00e0',
      'KMG-SYS-000': 'Import impossible'
    }
  }
} as const;

export default async function AdminCsvPage({ params }: AdminCsvPageProps) {
  const copy = adminPageCopy[params.locale];
  const currentUser = await requirePlatformAdmin();

  return (
    <AdminWorkspaceShell
      activeItem="csv"
      locale={params.locale}
      title={copy.importCsv}
      userEmail={currentUser.user.email}
    >
      <AssociationCsvImportForm copy={copy} />
    </AdminWorkspaceShell>
  );
}
