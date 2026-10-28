import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './lib/toast.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import PostulerPoste from './pages/public/PostulerPoste.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ModulePage from './pages/ModulePage.jsx';
import Users from './pages/Users.jsx';
import Roles from './pages/Roles.jsx';
import Parametres from './pages/Parametres.jsx';
import AchatsLayout from './pages/achats/AchatsLayout.jsx';
import AchatsApercu from './pages/achats/Apercu.jsx';
import DemandesAchat from './pages/achats/DemandesAchat.jsx';
import DemandeDetail from './pages/achats/DemandeDetail.jsx';
import Fournisseurs from './pages/achats/Fournisseurs.jsx';
import BonsDeCommande from './pages/achats/BonsDeCommande.jsx';
import BonDetail from './pages/achats/BonDetail.jsx';
import Receptions from './pages/achats/Receptions.jsx';
import Paiements from './pages/achats/Paiements.jsx';
import StocksLayout from './pages/stocks/StocksLayout.jsx';
import StocksApercu from './pages/stocks/Apercu.jsx';
import Articles from './pages/stocks/Articles.jsx';
import Mouvements from './pages/stocks/Mouvements.jsx';
import Inventaires from './pages/stocks/Inventaires.jsx';
import InventaireDetail from './pages/stocks/InventaireDetail.jsx';
import Alertes from './pages/stocks/Alertes.jsx';
import AdministrativeLayout from './pages/administrative/AdministrativeLayout.jsx';
import AdministrativeApercu from './pages/administrative/Apercu.jsx';
import Courrier from './pages/administrative/Courrier.jsx';
import CourrierDetail from './pages/administrative/CourrierDetail.jsx';
import ArchivesAdmin from './pages/administrative/Archives.jsx';
import ArchiveDetail from './pages/administrative/ArchiveDetail.jsx';
import DocumentsAdmin from './pages/administrative/Documents.jsx';
import DocumentDetail from './pages/administrative/DocumentDetail.jsx';
import Agenda from './pages/administrative/Agenda.jsx';
import Notes from './pages/administrative/Notes.jsx';
import NoteDetail from './pages/administrative/NoteDetail.jsx';
import RhLayout from './pages/rh/RhLayout.jsx';
import RhApercu from './pages/rh/Apercu.jsx';
import Employes from './pages/rh/Employes.jsx';
import Conges from './pages/rh/Conges.jsx';
import CongeDetail from './pages/rh/CongeDetail.jsx';
import Paies from './pages/rh/Paies.jsx';
import Evaluations from './pages/rh/Evaluations.jsx';
import Formations from './pages/rh/Formations.jsx';
import FormationDetail from './pages/rh/FormationDetail.jsx';
import MonDossier from './pages/rh/MonDossier.jsx';
import MesCourriers from './pages/rh/MesCourriers.jsx';
import RapportsActivite from './pages/rh/RapportsActivite.jsx';
import Recrutement from './pages/rh/Recrutement.jsx';
import PosteDetail from './pages/rh/PosteDetail.jsx';
import CandidatDetail from './pages/rh/CandidatDetail.jsx';
import EmployeDetail from './pages/rh/EmployeDetail.jsx';
import Presences from './pages/rh/Presences.jsx';
import CommercialLayout from './pages/commercial/CommercialLayout.jsx';
import CommercialApercu from './pages/commercial/Apercu.jsx';
import Clients from './pages/commercial/Clients.jsx';
import Devis from './pages/commercial/Devis.jsx';
import DevisDetail from './pages/commercial/DevisDetail.jsx';
import Commandes from './pages/commercial/Commandes.jsx';
import CommandeDetail from './pages/commercial/CommandeDetail.jsx';
import Factures from './pages/commercial/Factures.jsx';
import FactureDetail from './pages/commercial/FactureDetail.jsx';
import Encaissements from './pages/commercial/Encaissements.jsx';
import FinanceLayout from './pages/finance/FinanceLayout.jsx';
import FinanceApercu from './pages/finance/Apercu.jsx';
import Comptes from './pages/finance/Comptes.jsx';
import Recettes from './pages/finance/Recettes.jsx';
import Depenses from './pages/finance/Depenses.jsx';
import DepenseDetail from './pages/finance/DepenseDetail.jsx';
import Budgets from './pages/finance/Budgets.jsx';
import BudgetDetail from './pages/finance/BudgetDetail.jsx';
import Rapports from './pages/finance/Rapports.jsx';
import Tresorerie from './pages/finance/Tresorerie.jsx';
import Tiers from './pages/finance/Tiers.jsx';
import Engagements from './pages/finance/Engagements.jsx';
import ReportingLayout from './pages/reporting/ReportingLayout.jsx';
import RapportsLayout from './pages/rapports/RapportsLayout.jsx';
import ReportingApercu from './pages/reporting/Apercu.jsx';
import JournalAudit from './pages/reporting/JournalAudit.jsx';
import FormationLayout from './pages/formation/FormationLayout.jsx';
import FormationApercu from './pages/formation/Apercu.jsx';
import Ecoles from './pages/formation/Ecoles.jsx';
import EcoleDetail from './pages/formation/EcoleDetail.jsx';
import SalleDetail from './pages/formation/SalleDetail.jsx';
import ClasseDetail from './pages/formation/ClasseDetail.jsx';
import Camps from './pages/formation/Camps.jsx';
import Seances from './pages/formation/Seances.jsx';
import RapportsCours from './pages/formation/RapportsCours.jsx';
import Maintenance from './pages/formation/Maintenance.jsx';
import MaintenanceVisiteDetail from './pages/formation/MaintenanceVisiteDetail.jsx';
import ProspectionLayout from './pages/prospection/ProspectionLayout.jsx';
import ProspectionApercu from './pages/prospection/Apercu.jsx';
import Campagnes from './pages/prospection/Campagnes.jsx';
import CampagneDetail from './pages/prospection/CampagneDetail.jsx';
import EcolesCibles from './pages/prospection/EcolesCibles.jsx';
import EcoleCibleDetail from './pages/prospection/EcoleCibleDetail.jsx';
import ProspectionRapports from './pages/prospection/Rapports.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/postuler/:posteId" element={<PostulerPoste />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="modules/achats" element={<AchatsLayout />}>
              <Route index element={<AchatsApercu />} />
              <Route path="demandes" element={<DemandesAchat />} />
              <Route path="demandes/:id" element={<DemandeDetail />} />
              <Route path="fournisseurs" element={<Fournisseurs />} />
              <Route path="bons" element={<BonsDeCommande />} />
              <Route path="bons/:id" element={<BonDetail />} />
              <Route path="receptions" element={<Receptions />} />
              <Route path="paiements" element={<Paiements />} />
            </Route>
            <Route path="modules/stocks" element={<StocksLayout />}>
              <Route index element={<StocksApercu />} />
              <Route path="articles" element={<Articles />} />
              <Route path="entrees" element={<Mouvements type="entree" />} />
              <Route path="sorties" element={<Mouvements type="sortie" />} />
              <Route path="inventaires" element={<Inventaires />} />
              <Route path="inventaires/:id" element={<InventaireDetail />} />
              <Route path="alertes" element={<Alertes />} />
            </Route>
            <Route path="modules/administrative" element={<AdministrativeLayout />}>
              <Route index element={<AdministrativeApercu />} />
              <Route path="courrier-entrant" element={<Courrier sens="entrant" />} />
              <Route path="courrier-sortant" element={<Courrier sens="sortant" />} />
              <Route path="courrier/:id" element={<CourrierDetail />} />
              <Route path="archives" element={<ArchivesAdmin />} />
              <Route path="archives/:id" element={<ArchiveDetail />} />
              <Route path="documents" element={<DocumentsAdmin />} />
              <Route path="documents/:id" element={<DocumentDetail />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="notes" element={<Notes />} />
              <Route path="notes/:id" element={<NoteDetail />} />
            </Route>
            <Route path="modules/rh" element={<RhLayout />}>
              <Route index element={<RhApercu />} />
              <Route path="employes" element={<Employes />} />
              <Route path="employes/:id" element={<EmployeDetail />} />
              <Route path="conges" element={<Conges />} />
              <Route path="conges/:id" element={<CongeDetail />} />
              <Route path="paies" element={<Paies />} />
              <Route path="evaluations" element={<Evaluations />} />
              <Route path="formations" element={<Formations />} />
              <Route path="formations/:id" element={<FormationDetail />} />
              <Route path="mon-dossier" element={<MonDossier />} />
              <Route path="mes-courriers" element={<MesCourriers />} />
              <Route path="rapports-activite" element={<RapportsActivite />} />
              <Route path="recrutement" element={<Recrutement />} />
              <Route path="recrutement/:id" element={<PosteDetail />} />
              <Route path="candidats/:id" element={<CandidatDetail />} />
              <Route path="presences" element={<Presences />} />
            </Route>
            <Route path="modules/commercial" element={<CommercialLayout />}>
              <Route index element={<CommercialApercu />} />
              <Route path="clients" element={<Clients />} />
              <Route path="devis" element={<Devis />} />
              <Route path="devis/:id" element={<DevisDetail />} />
              <Route path="commandes" element={<Commandes />} />
              <Route path="commandes/:id" element={<CommandeDetail />} />
              <Route path="factures" element={<Factures />} />
              <Route path="factures/:id" element={<FactureDetail />} />
              <Route path="encaissements" element={<Encaissements />} />
            </Route>
            <Route path="modules/finance" element={<FinanceLayout />}>
              <Route index element={<FinanceApercu />} />
              <Route path="comptabilite" element={<Comptes />} />
              <Route path="recettes" element={<Recettes />} />
              <Route path="depenses" element={<Depenses />} />
              <Route path="depenses/:id" element={<DepenseDetail />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="budgets/:id" element={<BudgetDetail />} />
              <Route path="tresorerie" element={<Tresorerie />} />
              <Route path="tiers" element={<Tiers />} />
              <Route path="engagements" element={<Engagements />} />
              <Route path="rapports" element={<Rapports />} />
            </Route>
            <Route path="modules/formation" element={<FormationLayout />}>
              <Route index element={<FormationApercu />} />
              <Route path="ecoles" element={<Ecoles />} />
              <Route path="ecoles/:id" element={<EcoleDetail />} />
              <Route path="ecoles/:ecoleId/salles/:salleId" element={<SalleDetail />} />
              <Route path="ecoles/:ecoleId/classes/:classeId" element={<ClasseDetail />} />
              <Route path="camps" element={<Camps />} />
              <Route path="seances" element={<Seances />} />
              <Route path="rapports" element={<RapportsCours />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="maintenance/:id" element={<MaintenanceVisiteDetail />} />
            </Route>
            <Route path="modules/prospection" element={<ProspectionLayout />}>
              <Route index element={<ProspectionApercu />} />
              <Route path="campagnes" element={<Campagnes />} />
              <Route path="campagnes/:id" element={<CampagneDetail />} />
              <Route path="ecoles-cibles" element={<EcolesCibles />} />
              <Route path="ecoles-cibles/:id" element={<EcoleCibleDetail />} />
            </Route>
            <Route path="modules/rapports" element={<RapportsLayout />}>
              <Route path="cours" element={<RapportsCours />} />
              <Route path="activite" element={<RapportsActivite />} />
              <Route path="visite" element={<ProspectionRapports />} />
            </Route>
            <Route path="modules/reporting" element={<ReportingLayout />}>
              <Route index element={<ReportingApercu />} />
              <Route path="journal-audit" element={<JournalAudit />} />
            </Route>
            <Route path="modules/:code" element={<ModulePage />} />
            <Route
              path="admin/utilisateurs"
              element={
                <ProtectedRoute adminOnly>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/roles"
              element={
                <ProtectedRoute adminOnly>
                  <Roles />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/parametres"
              element={
                <ProtectedRoute adminOnly>
                  <Parametres />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
