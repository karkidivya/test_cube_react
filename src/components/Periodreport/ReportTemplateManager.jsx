// components/ReportTemplateManager.jsx
import React, { useState, useEffect } from 'react';

// Template storage key
const STORAGE_KEY = 'dynamic_report_templates';

// Built-in templates
const BUILT_IN_TEMPLATES = {
  dailySales: {
    name: 'Daily Sales Summary',
    category: 'Sales',
    query: {
      measures: [
        'business_sales.gross_revenue',
        'business_sales.net_revenue',
        'business_sales.total_transactions',
        'business_sales.average_check_size'
      ],
      dimensions: ['business_sales.TransactionDate'],
      filters: [
        {
          member: 'business_sales.TransactionDate',
          operator: 'inDateRange',
          values: ['last 7 days']
        }
      ],
      order: { 'business_sales.TransactionDate': 'desc' }
    },
    reportDefinition: {
      title: 'Daily Sales Summary',
      columns: [
        { field: 'business_sales.TransactionDate', header: 'Date', type: 'date', sticky: true },
        { field: 'business_sales.gross_revenue', header: 'Gross Revenue', type: 'currency' },
        { field: 'business_sales.net_revenue', header: 'Net Revenue', type: 'currency' },
        { field: 'business_sales.total_transactions', header: 'Transactions', type: 'number' },
        { field: 'business_sales.average_check_size', header: 'Avg Check', type: 'currency' }
      ]
    }
  },
  staffPerformance: {
    name: 'Staff Performance Report',
    category: 'Staff',
    query: {
      measures: [
        'staff_report_view.gross_employee_sales',
        'staff_report_view.net_employee_sales',
        'staff_report_view.service_quantity',
        'staff_report_view_queues.serviced_queue'
      ],
      dimensions: [
        'staff_report_view.EmployeeFullName',
        'staff_report_view.TransactionDate'
      ],
      filters: [
        {
          member: 'staff_report_view.TransactionDate',
          operator: 'inDateRange',
          values: ['yesterday']
        }
      ]
    },
    reportDefinition: {
      title: 'Staff Performance Report',
      columns: [
        { field: 'staff_report_view.EmployeeFullName', header: 'Employee', type: 'string', sticky: true },
        { field: 'staff_report_view.gross_employee_sales', header: 'Gross Sales', type: 'currency' },
        { field: 'staff_report_view.net_employee_sales', header: 'Net Sales', type: 'currency' },
        { field: 'staff_report_view.service_quantity', header: 'Services', type: 'number' },
        { field: 'staff_report_view_queues.serviced_queue', header: 'Queues', type: 'number' }
      ],
      grouping: {
        enabled: true,
        fields: ['staff_report_view.EmployeeFullName'],
        showTotals: true
      }
    }
  },
  monthlyComparison: {
    name: 'Monthly Revenue Comparison',
    category: 'Analytics',
    query: {
      measures: [
        'business_sales.gross_revenue',
        'business_sales.net_revenue',
        'business_sales.total_transactions'
      ],
      timeDimensions: [{
        dimension: 'business_sales.TransactionDate',
        granularity: 'month'
      }],
      filters: [
        {
          member: 'business_sales.TransactionDate',
          operator: 'inDateRange',
          values: ['last 12 months']
        }
      ]
    },
    reportDefinition: {
      title: 'Monthly Revenue Comparison',
      columns: [
        { field: 'business_sales.TransactionDate.month', header: 'Month', type: 'string' },
        { 
          field: 'business_sales.gross_revenue', 
          header: 'Gross Revenue', 
          type: 'currency',
          highlight: {
            condition: '>',
            value: 10000,
            style: { backgroundColor: '#d4edda' }
          }
        },
        { field: 'business_sales.net_revenue', header: 'Net Revenue', type: 'currency' },
        { field: 'business_sales.total_transactions', header: 'Transactions', type: 'number' }
      ]
    }
  }
};

function ReportTemplateManager({ onLoadTemplate }) {
  const [templates, setTemplates] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: '',
    query: '',
    reportDefinition: ''
  });

  // Load templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem(STORAGE_KEY);
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    }
  }, []);

  // Save templates to localStorage
  const saveTemplates = (updatedTemplates) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTemplates));
    setTemplates(updatedTemplates);
  };

  // Get all categories
  const categories = [
    'all',
    ...new Set([
      ...Object.values(BUILT_IN_TEMPLATES).map(t => t.category),
      ...Object.values(templates).map(t => t.category)
    ])
  ];

  // Filter templates by category
  const filteredTemplates = selectedCategory === 'all' 
    ? { ...BUILT_IN_TEMPLATES, ...templates }
    : Object.entries({ ...BUILT_IN_TEMPLATES, ...templates })
        .filter(([, template]) => template.category === selectedCategory)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  // Save new template
  const handleSaveTemplate = () => {
    try {
      const query = JSON.parse(newTemplate.query);
      const reportDefinition = JSON.parse(newTemplate.reportDefinition);
      
      const templateKey = newTemplate.name.toLowerCase().replace(/\s+/g, '_');
      const updatedTemplates = {
        ...templates,
        [templateKey]: {
          name: newTemplate.name,
          category: newTemplate.category,
          query,
          reportDefinition
        }
      };
      
      saveTemplates(updatedTemplates);
      setShowSaveDialog(false);
      setNewTemplate({ name: '', category: '', query: '', reportDefinition: '' });
    } catch (error) {
      alert('Invalid JSON: ' + error.message);
    }
  };

  // Delete template
  const handleDeleteTemplate = (templateKey) => {
    if (BUILT_IN_TEMPLATES[templateKey]) {
      alert('Cannot delete built-in templates');
      return;
    }
    
    if (window.confirm('Delete this template?')) {
      const updatedTemplates = { ...templates };
      delete updatedTemplates[templateKey];
      saveTemplates(updatedTemplates);
    }
  };

  // Export template
  const handleExportTemplate = (templateKey, template) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${templateKey}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import template
  const handleImportTemplate = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          const templateKey = imported.name.toLowerCase().replace(/\s+/g, '_');
          
          const updatedTemplates = {
            ...templates,
            [templateKey]: imported
          };
          
          saveTemplates(updatedTemplates);
          alert('Template imported successfully!');
        } catch (error) {
          alert('Failed to import template: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Report Templates</h2>
      
      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px' }}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => setShowSaveDialog(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Save Current as Template
        </button>
        
        <label style={{
          padding: '8px 16px',
          backgroundColor: '#17a2b8',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Import Template
          <input
            type="file"
            accept=".json"
            onChange={handleImportTemplate}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Template Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {Object.entries(filteredTemplates).map(([key, template]) => (
          <div
            key={key}
            style={{
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: '#f8f9fa'
            }}
          >
            <h4 style={{ margin: '0 0 10px 0' }}>{template.name}</h4>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#6c757d',
              fontSize: '14px' 
            }}>
              Category: {template.category}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => onLoadTemplate(template.query, template.reportDefinition)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Load
              </button>
              <button
                onClick={() => handleExportTemplate(key, template)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Export
              </button>
              {!BUILT_IN_TEMPLATES[key] && (
                <button
                  onClick={() => handleDeleteTemplate(key)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Save Template</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Template Name:</label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Category:</label>
              <input
                type="text"
                value={newTemplate.category}
                onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                placeholder="e.g., Sales, Staff, Analytics"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Query JSON:</label>
              <textarea
                value={newTemplate.query}
                onChange={(e) => setNewTemplate({ ...newTemplate, query: e.target.value })}
                style={{ 
                  width: '100%', 
                  height: '150px', 
                  padding: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Report Definition JSON:</label>
              <textarea
                value={newTemplate.reportDefinition}
                onChange={(e) => setNewTemplate({ ...newTemplate, reportDefinition: e.target.value })}
                style={{ 
                  width: '100%', 
                  height: '150px', 
                  padding: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveDialog(false)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportTemplateManager;