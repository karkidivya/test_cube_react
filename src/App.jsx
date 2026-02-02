// App.jsx
import React from 'react';
import { CubeProvider } from '@cubejs-client/react';
import { cubeApi } from './config/cube';
import SalesData from './components/businessdatausingcubequery';
import SimpleQueryBuilder from './components/querybuilder';
import SalesQueryBuilder from './components/SalesQueryBuilder';
import AdvancedPeriodReport from './components/AdvancedPeriodReport';
import MultiViewQueryBuilder from './components/MultiViewQueryBuilder';
import TransactionReportTable from './components/Periodreport/TransactionReport';
import StaffPeriodReportTable from './components/Periodreport/StaffReport';
import ReportTemplateManager from './components/Periodreport/ReportTemplateManager';
import DynamicReportGenerator from './components/Periodreport/DynamicReportGenerator';
import AdminReportBuilder from './components/AdminReportBuilder';
import CustomQueryBuilder from './components/CustomQueryBuilder';
import MultiQueryReportBuilder from './components/MultiQueryReportBuilder';
import SimplifiedMultiQueryBuilder from './components/SimplifiedMultiQueryBuilder';

function App() {
  // const [view, setView] = useState('hook'); // 'hook', 'simple', or 'interactive'

  return (
    //  <CubeProvider cubeApi={cubeApi}>
    //   // {/* <MultiViewQueryBuilder/> */}
    //   // {/* <TransactionReportTable/> */}
    //   // <br></br>
    //   // {/* <StaffPeriodReportTable/> */}
    //   //  {/* <AdvancedPeriodReport/> */}
    //   //  {/* <DynamicReportGenerator/> */}
    //       <CustomQueryBuilder />

    //  </CubeProvider>
  // <AdminReportBuilder />
  //  <MultiQueryReportBuilder />
   <SimplifiedMultiQueryBuilder />
  );
}

export default App;