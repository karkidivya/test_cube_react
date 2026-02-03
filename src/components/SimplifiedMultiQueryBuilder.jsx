import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CubeProvider } from '@cubejs-client/react';
import cubejs from '@cubejs-client/core';
import { 
  Button, Card, Table, Space, message, 
  Input, DatePicker, Select, Row, Col, Spin, Alert, Divider, Tag, TreeSelect, Segmented
} from 'antd';
import { 
  Plus, Trash2, Play, Download, FileJson, 
  Calendar, Database, RefreshCw, CheckCircle, Link,
  Minimize2, Maximize2, BarChart2, Hash, Clock, Copy, Filter, Edit3,
  Table2, PieChart, TrendingUp, AreaChart, SlidersHorizontal, X
} from 'lucide-react';
import dayjs from 'dayjs';
import * as d3 from 'd3';
import 'antd/dist/reset.css';
import './SmartQueryExecutor.css';

const { RangePicker } = DatePicker;

// Chart Colors
const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const CHART_HEIGHT = 350;

// D3 Chart Component
const D3Chart = ({ data, chartType, dimensionKey, measureKeys, columnAliases = {}, dimensionAliasMap = {} }) => {
  const chartRef = useRef(null);

  const getDisplayName = (key) => {
    if (dimensionAliasMap[key]) return dimensionAliasMap[key];
    if (columnAliases[key]) return columnAliases[key];
    let name = key;
    name = name.replace(/^Query \d+\./, '');
    name = name.replace(/^[a-z_]+\./i, '');
    name = name.replace(/\.(day|month|year|week|hour)$/, '');
    return name;
  };

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const node = chartRef.current;
    d3.select(node).html('');

    if (chartType === 'pie') {
      drawPieChart(node, data, measureKeys[0], dimensionKey, getDisplayName);
    } else if (chartType === 'line') {
      drawLineChart(node, data, measureKeys, dimensionKey, getDisplayName);
    } else if (chartType === 'area') {
      drawAreaChart(node, data, measureKeys, dimensionKey, getDisplayName);
    } else {
      drawBarChart(node, data, measureKeys, dimensionKey, getDisplayName);
    }
  }, [data, chartType, dimensionKey, measureKeys, columnAliases, dimensionAliasMap]);

  return <div ref={chartRef} className="d3-chart-container" />;
};

// Draw Bar Chart
const drawBarChart = (node, data, measureKeys, dimensionKey, getDisplayName) => {
  const margin = { top: 20, right: 120, bottom: 60, left: 80 };
  const width = node.clientWidth - margin.left - margin.right;
  const height = CHART_HEIGHT - margin.top - margin.bottom;

  const svg = d3.select(node)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Get x values (dimension values)
  const xValues = data.map(d => String(d[dimensionKey] || ''));
  
  // Create scales
  const x0 = d3.scaleBand()
    .domain(xValues)
    .range([0, width])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(measureKeys)
    .range([0, x0.bandwidth()])
    .padding(0.05);

  const maxValue = d3.max(data, d => d3.max(measureKeys, key => +d[key] || 0));
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(measureKeys)
    .range(CHART_COLORS);

  // Add X axis
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');

  // Add Y axis
  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')));

  // Add bars
  const barGroups = svg.selectAll('.bar-group')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'bar-group')
    .attr('transform', d => `translate(${x0(String(d[dimensionKey] || ''))},0)`);

  barGroups.selectAll('rect')
    .data(d => measureKeys.map(key => ({ key, value: +d[key] || 0 })))
    .enter()
    .append('rect')
    .attr('x', d => x1(d.key))
    .attr('y', d => y(d.value))
    .attr('width', x1.bandwidth())
    .attr('height', d => height - y(d.value))
    .attr('fill', d => color(d.key))
    .attr('rx', 2);

  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width + 10}, 0)`);

  measureKeys.forEach((key, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    g.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', color(key))
      .attr('rx', 2);
    
    g.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('font-size', '11px')
      .text(getDisplayName(key));
  });
};

// Draw Line Chart
const drawLineChart = (node, data, measureKeys, dimensionKey, getDisplayName) => {
  const margin = { top: 20, right: 120, bottom: 60, left: 80 };
  const width = node.clientWidth - margin.left - margin.right;
  const height = CHART_HEIGHT - margin.top - margin.bottom;

  const svg = d3.select(node)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xValues = data.map(d => String(d[dimensionKey] || ''));
  
  // Try to parse as dates
  const isDateDimension = data.length > 0 && 
    !isNaN(Date.parse(String(data[0][dimensionKey])));

  let x;
  if (isDateDimension) {
    x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d[dimensionKey])))
      .range([0, width]);
  } else {
    x = d3.scalePoint()
      .domain(xValues)
      .range([0, width])
      .padding(0.5);
  }

  const maxValue = d3.max(data, d => d3.max(measureKeys, key => +d[key] || 0));
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(measureKeys)
    .range(CHART_COLORS);

  // Add X axis
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(isDateDimension ? d3.axisBottom(x).ticks(6) : d3.axisBottom(x))
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');

  // Add Y axis
  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')));

  // Add grid lines
  svg.append('g')
    .attr('class', 'grid')
    .attr('opacity', 0.1)
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''));

  // Draw lines
  measureKeys.forEach(key => {
    const line = d3.line()
      .x(d => isDateDimension ? x(new Date(d[dimensionKey])) : x(String(d[dimensionKey] || '')))
      .y(d => y(+d[key] || 0))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color(key))
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Add dots
    svg.selectAll(`.dot-${key}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => isDateDimension ? x(new Date(d[dimensionKey])) : x(String(d[dimensionKey] || '')))
      .attr('cy', d => y(+d[key] || 0))
      .attr('r', 4)
      .attr('fill', color(key));
  });

  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width + 10}, 0)`);

  measureKeys.forEach((key, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    g.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', color(key))
      .attr('rx', 2);
    
    g.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('font-size', '11px')
      .text(getDisplayName(key));
  });
};

// Draw Area Chart
const drawAreaChart = (node, data, measureKeys, dimensionKey, getDisplayName) => {
  const margin = { top: 20, right: 120, bottom: 60, left: 80 };
  const width = node.clientWidth - margin.left - margin.right;
  const height = CHART_HEIGHT - margin.top - margin.bottom;

  const svg = d3.select(node)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const isDateDimension = data.length > 0 && 
    !isNaN(Date.parse(String(data[0][dimensionKey])));

  let x;
  if (isDateDimension) {
    x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d[dimensionKey])))
      .range([0, width]);
  } else {
    x = d3.scalePoint()
      .domain(data.map(d => String(d[dimensionKey] || '')))
      .range([0, width])
      .padding(0.5);
  }

  const maxValue = d3.max(data, d => d3.max(measureKeys, key => +d[key] || 0));
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(measureKeys)
    .range(CHART_COLORS);

  // Add X axis
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(isDateDimension ? d3.axisBottom(x).ticks(6) : d3.axisBottom(x))
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');

  // Add Y axis
  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')));

  // Draw areas
  measureKeys.forEach(key => {
    const area = d3.area()
      .x(d => isDateDimension ? x(new Date(d[dimensionKey])) : x(String(d[dimensionKey] || '')))
      .y0(height)
      .y1(d => y(+d[key] || 0))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', color(key))
      .attr('fill-opacity', 0.3)
      .attr('stroke', color(key))
      .attr('stroke-width', 2)
      .attr('d', area);
  });

  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width + 10}, 0)`);

  measureKeys.forEach((key, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    g.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', color(key))
      .attr('rx', 2);
    
    g.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('font-size', '11px')
      .text(getDisplayName(key));
  });
};

// Draw Pie Chart
const drawPieChart = (node, data, measureKey, dimensionKey, getDisplayName) => {
  const width = node.clientWidth;
  const height = CHART_HEIGHT;
  const radius = Math.min(width, height) / 2 - 60;

  const svg = d3.select(node)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2 - 60},${height / 2})`);

  const pieData = data.map(d => ({
    label: String(d[dimensionKey] || 'Unknown'),
    value: +d[measureKey] || 0
  })).filter(d => d.value > 0);

  const color = d3.scaleOrdinal()
    .domain(pieData.map(d => d.label))
    .range(CHART_COLORS);

  const pie = d3.pie()
    .value(d => d.value)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  const arcs = svg.selectAll('.arc')
    .data(pie(pieData))
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => color(d.data.label))
    .attr('stroke', 'white')
    .attr('stroke-width', 2);

  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${radius + 30}, ${-pieData.length * 10})`);

  pieData.forEach((d, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 22})`);
    
    g.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('fill', color(d.label))
      .attr('rx', 2);
    
    g.append('text')
      .attr('x', 20)
      .attr('y', 11)
      .attr('font-size', '11px')
      .text(`${d.label}: ${d.value.toLocaleString()}`);
  });
};

// JSON Syntax Highlighter Component
const JsonSyntaxHighlight = ({ json }) => {
  const syntaxHighlight = (jsonObj) => {
    const jsonStr = JSON.stringify(jsonObj, null, 2);
    
    // Replace JSON elements with styled spans
    return jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        let cls = 'json-string';
        if (/:$/.test(match)) {
          cls = 'json-key';
        }
        return `<span class="${cls}">${match}</span>`;
      })
      .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
  };

  return (
    <pre 
      className="json-highlighted"
      dangerouslySetInnerHTML={{ __html: syntaxHighlight(json) }}
    />
  );
};

// Query Preview Editor Component - Editable JSON
const QueryPreviewEditor = ({ query, onQueryChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [parseError, setParseError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync edited JSON when query changes from UI
  useEffect(() => {
    if (!isEditing) {
      setEditedJson(JSON.stringify(query, null, 2));
    }
  }, [query, isEditing]);

  // Initialize edited JSON when entering edit mode
  const handleStartEditing = () => {
    setEditedJson(JSON.stringify(query, null, 2));
    setParseError(null);
    setHasChanges(false);
    setIsEditing(true);
  };

  // Handle JSON text changes
  const handleJsonChange = (e) => {
    const newValue = e.target.value;
    setEditedJson(newValue);
    setHasChanges(true);
    
    // Validate JSON in real-time
    try {
      JSON.parse(newValue);
      setParseError(null);
    } catch (err) {
      setParseError(err.message);
    }
  };

  // Apply changes from JSON editor
  const handleApplyChanges = () => {
    try {
      const parsedQuery = JSON.parse(editedJson);
      
      // Validate the query structure
      if (typeof parsedQuery !== 'object' || parsedQuery === null) {
        setParseError('Query must be a JSON object');
        return;
      }

      // Ensure arrays are arrays
      if (parsedQuery.measures && !Array.isArray(parsedQuery.measures)) {
        setParseError('measures must be an array');
        return;
      }
      if (parsedQuery.dimensions && !Array.isArray(parsedQuery.dimensions)) {
        setParseError('dimensions must be an array');
        return;
      }
      if (parsedQuery.timeDimensions && !Array.isArray(parsedQuery.timeDimensions)) {
        setParseError('timeDimensions must be an array');
        return;
      }
      if (parsedQuery.segments && !Array.isArray(parsedQuery.segments)) {
        setParseError('segments must be an array');
        return;
      }

      // Apply the parsed query
      onQueryChange(parsedQuery);
      setIsEditing(false);
      setHasChanges(false);
      setParseError(null);
      message.success('Query updated from JSON!');
    } catch (err) {
      setParseError(err.message);
    }
  };

  // Cancel editing
  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedJson(JSON.stringify(query, null, 2));
    setParseError(null);
    setHasChanges(false);
  };

  // Copy to clipboard
  const handleCopy = () => {
    const jsonToCopy = isEditing ? editedJson : JSON.stringify(query, null, 2);
    navigator.clipboard.writeText(jsonToCopy);
    message.success('Query copied to clipboard!');
  };

  // Format/prettify JSON
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(editedJson);
      setEditedJson(JSON.stringify(parsed, null, 2));
      setParseError(null);
      message.success('JSON formatted!');
    } catch (err) {
      setParseError(err.message);
    }
  };

  const isEmpty = !query.measures?.length && !query.dimensions?.length && 
                  !query.timeDimensions?.length && !query.segments?.length;

  return (
    <div className="query-preview-section">
      <div className="query-preview-header">
        <label className="builder-label">
          <FileJson size={14} />
          Live Query Preview
          {isEditing && <Tag color="orange" style={{ marginLeft: 8 }}>Editing</Tag>}
        </label>
        <Space size="small">
          {isEditing ? (
            <>
              <Button
                size="small"
                onClick={handleFormat}
                disabled={!!parseError}
              >
                Format
              </Button>
              <Button
                size="small"
                icon={<Copy size={14} />}
                onClick={handleCopy}
              >
                Copy
              </Button>
              <Button
                size="small"
                onClick={handleCancelEditing}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircle size={14} />}
                onClick={handleApplyChanges}
                disabled={!!parseError || !hasChanges}
              >
                Apply
              </Button>
            </>
          ) : (
            <>
              <Button
                size="small"
                icon={<Copy size={14} />}
                onClick={handleCopy}
                disabled={isEmpty}
              >
                Copy
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<Edit3 size={14} />}
                onClick={handleStartEditing}
              >
                Edit JSON
              </Button>
            </>
          )}
        </Space>
      </div>

      {parseError && (
        <Alert
          message="JSON Parse Error"
          description={parseError}
          type="error"
          showIcon
          style={{ margin: '8px 12px', borderRadius: 6 }}
        />
      )}

      <div className="query-preview-code">
        {isEditing ? (
          <textarea
            className="json-editor"
            value={editedJson}
            onChange={handleJsonChange}
            spellCheck={false}
            placeholder='{"measures": [], "dimensions": [], "timeDimensions": []}'
          />
        ) : isEmpty ? (
          <div className="json-empty-state">
            <p>No query configured yet.</p>
            <p>Use the selectors above or click "Edit JSON" to write a query manually.</p>
            <Button 
              type="primary" 
              icon={<Edit3 size={14} />}
              onClick={handleStartEditing}
              style={{ marginTop: 12 }}
            >
              Edit JSON
            </Button>
          </div>
        ) : (
          <JsonSyntaxHighlight json={query} />
        )}
      </div>

      {isEditing && (
        <div className="query-editor-hints">
          <Alert
            message="Editing Tips"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><strong>measures:</strong> Array of measure names like "cube.measureName"</li>
                <li><strong>dimensions:</strong> Array of dimension names</li>
                <li><strong>timeDimensions:</strong> Array of objects with dimension, granularity</li>
                <li><strong>segments:</strong> Array of segment names</li>
                <li><strong>filters:</strong> Array of filter objects</li>
                <li><strong>order:</strong> Object for sorting</li>
                <li><strong>limit:</strong> Number to limit results</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ margin: '8px 0 0 0', borderRadius: '0 0 10px 10px' }}
          />
        </div>
      )}
    </div>
  );
};

// Custom Query Builder Component - React 19 Compatible
const CustomQueryBuilder = ({ 
  cubeApi, 
  query, 
  onQueryChange,
  queryName,
  onQueryNameChange
}) => {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter operators by type
  const FILTER_OPERATORS = {
    string: [
      { label: 'equals', value: 'equals' },
      { label: 'not equals', value: 'notEquals' },
      { label: 'contains', value: 'contains' },
      { label: 'not contains', value: 'notContains' },
      { label: 'starts with', value: 'startsWith' },
      { label: 'ends with', value: 'endsWith' },
      { label: 'is set', value: 'set' },
      { label: 'is not set', value: 'notSet' },
    ],
    number: [
      { label: 'equals', value: 'equals' },
      { label: 'not equals', value: 'notEquals' },
      { label: 'greater than', value: 'gt' },
      { label: 'greater than or equal', value: 'gte' },
      { label: 'less than', value: 'lt' },
      { label: 'less than or equal', value: 'lte' },
      { label: 'is set', value: 'set' },
      { label: 'is not set', value: 'notSet' },
    ],
    time: [
      { label: 'equals', value: 'equals' },
      { label: 'not equals', value: 'notEquals' },
      { label: 'before', value: 'beforeDate' },
      { label: 'before or on', value: 'beforeOrOnDate' },
      { label: 'after', value: 'afterDate' },
      { label: 'after or on', value: 'afterOrOnDate' },
      { label: 'in date range', value: 'inDateRange' },
      { label: 'not in date range', value: 'notInDateRange' },
      { label: 'is set', value: 'set' },
      { label: 'is not set', value: 'notSet' },
    ],
  };

  // Fetch Cube.js meta (schema)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        setLoading(true);
        const metaResponse = await cubeApi.meta();
        setMeta(metaResponse);
        setError(null);
      } catch (err) {
        console.error('Error fetching meta:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeta();
  }, [cubeApi]);

  // Build tree data for measures
  const buildMeasuresTree = useCallback(() => {
    if (!meta?.cubes) return [];
    
    return meta.cubes.map(cube => ({
      title: cube.name,
      value: cube.name,
      key: cube.name,
      selectable: false,
      children: (cube.measures || []).map(measure => ({
        title: (
          <span className="tree-item">
            <Hash size={12} className="tree-icon measure-icon" />
            {measure.shortTitle || measure.name.split('.')[1]}
          </span>
        ),
        value: measure.name,
        key: measure.name,
      }))
    })).filter(cube => cube.children.length > 0);
  }, [meta]);

  // Build tree data for dimensions
  const buildDimensionsTree = useCallback(() => {
    if (!meta?.cubes) return [];
    
    return meta.cubes.map(cube => ({
      title: cube.name,
      value: cube.name,
      key: cube.name,
      selectable: false,
      children: (cube.dimensions || []).map(dimension => ({
        title: (
          <span className="tree-item">
            {dimension.type === 'time' ? (
              <Clock size={12} className="tree-icon time-icon" />
            ) : (
              <Database size={12} className="tree-icon dimension-icon" />
            )}
            {dimension.shortTitle || dimension.name.split('.')[1]}
            {dimension.type === 'time' && <Tag color="purple" className="ml-1" style={{ fontSize: 10 }}>time</Tag>}
          </span>
        ),
        value: dimension.name,
        key: dimension.name,
        isTime: dimension.type === 'time'
      }))
    })).filter(cube => cube.children.length > 0);
  }, [meta]);

  // Get time dimensions from meta
  const getTimeDimensions = useCallback(() => {
    if (!meta?.cubes) return [];
    
    const timeDims = [];
    meta.cubes.forEach(cube => {
      (cube.dimensions || []).forEach(dim => {
        if (dim.type === 'time') {
          timeDims.push({
            label: `${cube.name} - ${dim.shortTitle || dim.name.split('.')[1]}`,
            value: dim.name
          });
        }
      });
    });
    return timeDims;
  }, [meta]);

  // Build tree data for time dimensions (searchable like regular dimensions)
  const buildTimeDimensionsTree = useCallback(() => {
    if (!meta?.cubes) return [];
    
    return meta.cubes.map(cube => ({
      title: cube.name,
      value: cube.name,
      key: cube.name,
      selectable: false,
      children: (cube.dimensions || [])
        .filter(dim => dim.type === 'time')
        .map(dimension => ({
          title: (
            <span className="tree-item">
              <Clock size={12} className="tree-icon time-icon" />
              {dimension.shortTitle || dimension.name.split('.')[1]}
            </span>
          ),
          value: dimension.name,
          key: dimension.name,
        }))
    })).filter(cube => cube.children.length > 0);
  }, [meta]);

  // Build tree data for segments
  const buildSegmentsTree = useCallback(() => {
    if (!meta?.cubes) return [];
    
    return meta.cubes.map(cube => ({
      title: cube.name,
      value: cube.name,
      key: cube.name,
      selectable: false,
      children: (cube.segments || []).map(segment => ({
        title: (
          <span className="tree-item">
            <Filter size={12} className="tree-icon segment-icon" />
            {segment.shortTitle || segment.name.split('.')[1]}
          </span>
        ),
        value: segment.name,
        key: segment.name,
      }))
    })).filter(cube => cube.children.length > 0);
  }, [meta]);

  // Handle measure selection
  const handleMeasuresChange = (values) => {
    onQueryChange({
      ...query,
      measures: values || []
    });
  };

  // Handle dimension selection
  const handleDimensionsChange = (values) => {
    onQueryChange({
      ...query,
      dimensions: values || []
    });
  };

  // Handle segment selection
  const handleSegmentsChange = (values) => {
    onQueryChange({
      ...query,
      segments: values || []
    });
  };

  // Get all available members for filtering (dimensions + measures)
  const getFilterableMembers = useCallback(() => {
    if (!meta?.cubes) return [];
    
    const members = [];
    meta.cubes.forEach(cube => {
      // Add dimensions
      (cube.dimensions || []).forEach(dim => {
        members.push({
          name: dim.name,
          title: dim.shortTitle || dim.name.split('.')[1],
          type: dim.type || 'string',
          cubeName: cube.name,
          memberType: 'dimension'
        });
      });
      // Add measures
      (cube.measures || []).forEach(measure => {
        members.push({
          name: measure.name,
          title: measure.shortTitle || measure.name.split('.')[1],
          type: 'number',
          cubeName: cube.name,
          memberType: 'measure'
        });
      });
    });
    return members;
  }, [meta]);

  // Get operator options based on member type
  const getOperatorsForType = (type) => {
    if (type === 'time') return FILTER_OPERATORS.time;
    if (type === 'number') return FILTER_OPERATORS.number;
    return FILTER_OPERATORS.string;
  };

  // Add a new filter
  const handleAddFilter = () => {
    const newFilter = {
      member: undefined,
      operator: 'equals',
      values: []
    };
    onQueryChange({
      ...query,
      filters: [...(query.filters || []), newFilter]
    });
  };

  // Update a filter
  const handleUpdateFilter = (index, field, value) => {
    const newFilters = [...(query.filters || [])];
    newFilters[index] = {
      ...newFilters[index],
      [field]: value
    };
    
    // Reset values if member changes
    if (field === 'member') {
      newFilters[index].values = [];
      // Set default operator based on type
      const member = getFilterableMembers().find(m => m.name === value);
      if (member?.type === 'time') {
        newFilters[index].operator = 'inDateRange';
      } else {
        newFilters[index].operator = 'equals';
      }
    }
    
    onQueryChange({
      ...query,
      filters: newFilters
    });
  };

  // Remove a filter
  const handleRemoveFilter = (index) => {
    const newFilters = (query.filters || []).filter((_, i) => i !== index);
    onQueryChange({
      ...query,
      filters: newFilters
    });
  };

  // Handle time dimension selection (single select TreeSelect)
  const handleTimeDimensionChange = (dimension) => {
    if (!dimension) {
      onQueryChange({
        ...query,
        timeDimensions: []
      });
      return;
    }

    const existingTimeDim = query.timeDimensions?.[0] || {};
    onQueryChange({
      ...query,
      timeDimensions: [{
        dimension: dimension,
        granularity: existingTimeDim.granularity || 'day',
        dateRange: existingTimeDim.dateRange
      }]
    });
  };

  // Handle granularity change
  const handleGranularityChange = (granularity) => {
    const existingTimeDim = query.timeDimensions?.[0];
    if (!existingTimeDim) return;

    onQueryChange({
      ...query,
      timeDimensions: [{
        ...existingTimeDim,
        granularity
      }]
    });
  };

  if (loading) {
    return (
      <div className="query-builder-loading">
        <Spin size="large" />
        <p>Loading schema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Schema"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  const measuresTree = buildMeasuresTree();
  const dimensionsTree = buildDimensionsTree();
  const timeDimensionsTree = buildTimeDimensionsTree();
  const segmentsTree = buildSegmentsTree();
  const timeDimensions = getTimeDimensions();
  const currentTimeDim = query.timeDimensions?.[0];

  return (
    <div className="custom-query-builder">
      {/* Query Name */}
      <div className="builder-section">
        <label className="builder-label">Query Name</label>
        <Input
          value={queryName}
          onChange={(e) => onQueryNameChange(e.target.value)}
          placeholder="Enter query name"
        />
      </div>

      {/* Measures */}
      <div className="builder-section">
        <label className="builder-label">
          <Hash size={14} />
          Measures
        </label>
        <TreeSelect
          treeData={measuresTree}
          value={query.measures || []}
          onChange={handleMeasuresChange}
          treeCheckable
          showCheckedStrategy={TreeSelect.SHOW_CHILD}
          placeholder="Type to search measures..."
          style={{ width: '100%' }}
          maxTagCount={3}
          allowClear
          showSearch
          filterTreeNode={(inputValue, treeNode) => {
            const searchValue = inputValue.toLowerCase();
            const nodeValue = (treeNode.value || '').toLowerCase();
            return nodeValue.includes(searchValue);
          }}
          treeDefaultExpandAll={false}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        />
        {query.measures?.length > 0 && (
          <div className="selected-items">
            {query.measures.map(m => (
              <Tag key={m} color="blue" closable onClose={() => {
                handleMeasuresChange(query.measures.filter(x => x !== m));
              }}>
                {m.split('.')[1] || m}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className="builder-section">
        <label className="builder-label">
          <Database size={14} />
          Dimensions
        </label>
        <TreeSelect
          treeData={dimensionsTree}
          value={query.dimensions || []}
          onChange={handleDimensionsChange}
          treeCheckable
          showCheckedStrategy={TreeSelect.SHOW_CHILD}
          placeholder="Type to search dimensions..."
          style={{ width: '100%' }}
          maxTagCount={3}
          allowClear
          showSearch
          filterTreeNode={(inputValue, treeNode) => {
            const searchValue = inputValue.toLowerCase();
            const nodeValue = (treeNode.value || '').toLowerCase();
            return nodeValue.includes(searchValue);
          }}
          treeDefaultExpandAll={false}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        />
        {query.dimensions?.length > 0 && (
          <div className="selected-items">
            {query.dimensions.map(d => (
              <Tag key={d} color="green" closable onClose={() => {
                handleDimensionsChange(query.dimensions.filter(x => x !== d));
              }}>
                {d.split('.')[1] || d}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* Time Dimension */}
      <div className="builder-section">
        <label className="builder-label">
          <Clock size={14} />
          Time Dimension
        </label>
        <Row gutter={12}>
          <Col span={16}>
            <TreeSelect
              treeData={timeDimensionsTree}
              value={currentTimeDim?.dimension || undefined}
              onChange={(value) => handleTimeDimensionChange(value || null)}
              placeholder="Type to search time dimension..."
              style={{ width: '100%' }}
              allowClear
              treeDefaultExpandAll={false}
              showSearch
              filterTreeNode={(inputValue, treeNode) => {
                // Search by value (dimension name) case-insensitively
                const searchValue = inputValue.toLowerCase();
                const nodeValue = (treeNode.value || '').toLowerCase();
                const nodeTitle = treeNode.title?.props?.children?.[1] || '';
                const titleText = typeof nodeTitle === 'string' ? nodeTitle.toLowerCase() : '';
                return nodeValue.includes(searchValue) || titleText.includes(searchValue);
              }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeLine={{ showLeafIcon: false }}
            />
          </Col>
          <Col span={8}>
            <Select
              value={currentTimeDim?.granularity || 'day'}
              onChange={handleGranularityChange}
              disabled={!currentTimeDim?.dimension}
              style={{ width: '100%' }}
              options={[
                { label: 'Hour', value: 'hour' },
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Year', value: 'year' },
              ]}
            />
          </Col>
        </Row>
        {currentTimeDim?.dimension && (
          <div className="selected-items">
            <Tag color="purple" closable onClose={() => handleTimeDimensionChange(null)}>
              {currentTimeDim.dimension.split('.')[1] || currentTimeDim.dimension}
              {currentTimeDim.granularity && ` (${currentTimeDim.granularity})`}
            </Tag>
          </div>
        )}
      </div>

      {/* Segments */}
      {segmentsTree.length > 0 && (
        <div className="builder-section">
          <label className="builder-label">
            <Filter size={14} />
            Segments
          </label>
          <TreeSelect
            treeData={segmentsTree}
            value={query.segments || []}
            onChange={handleSegmentsChange}
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            placeholder="Type to search segments..."
            style={{ width: '100%' }}
            maxTagCount={3}
            allowClear
            showSearch
            filterTreeNode={(inputValue, treeNode) => {
              const searchValue = inputValue.toLowerCase();
              const nodeValue = (treeNode.value || '').toLowerCase();
              return nodeValue.includes(searchValue);
            }}
            treeDefaultExpandAll={false}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          />
          {query.segments?.length > 0 && (
            <div className="selected-items">
              {query.segments.map(s => (
                <Tag key={s} color="orange" closable onClose={() => {
                  handleSegmentsChange(query.segments.filter(x => x !== s));
                }}>
                  {s.split('.')[1] || s}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="builder-section">
        <div className="filter-section-header">
          <label className="builder-label">
            <SlidersHorizontal size={14} />
            Filters
          </label>
          <Button
            size="small"
            type="dashed"
            icon={<Plus size={14} />}
            onClick={handleAddFilter}
          >
            Add Filter
          </Button>
        </div>
        
        {(query.filters || []).length === 0 ? (
          <div className="filter-empty-state">
            <p>No filters added. Click "Add Filter" to filter your query results.</p>
          </div>
        ) : (
          <div className="filters-list">
            {(query.filters || []).map((filter, index) => {
              const filterableMembers = getFilterableMembers();
              const selectedMember = filterableMembers.find(m => m.name === filter.member);
              const operators = getOperatorsForType(selectedMember?.type || 'string');
              const needsValues = !['set', 'notSet'].includes(filter.operator);
              const isDateRange = ['inDateRange', 'notInDateRange'].includes(filter.operator);
              const isDateOperator = ['beforeDate', 'beforeOrOnDate', 'afterDate', 'afterOrOnDate'].includes(filter.operator);
              
              return (
                <div key={index} className="filter-row">
                  <div className="filter-row-content">
                    {/* Member Select */}
                    <div className="filter-field filter-member">
                      <Select
                        value={filter.member}
                        onChange={(value) => handleUpdateFilter(index, 'member', value)}
                        placeholder="Select field"
                        style={{ width: '100%' }}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={filterableMembers.map(m => ({
                          label: `${m.cubeName}.${m.title}`,
                          value: m.name,
                          title: m.name
                        }))}
                      />
                    </div>
                    
                    {/* Operator Select */}
                    <div className="filter-field filter-operator">
                      <Select
                        value={filter.operator}
                        onChange={(value) => handleUpdateFilter(index, 'operator', value)}
                        style={{ width: '100%' }}
                        disabled={!filter.member}
                        options={operators}
                      />
                    </div>
                    
                    {/* Values Input */}
                    <div className="filter-field filter-values">
                      {needsValues && (
                        isDateRange ? (
                          <RangePicker
                            value={filter.values?.length === 2 ? [
                              dayjs(filter.values[0]),
                              dayjs(filter.values[1])
                            ] : null}
                            onChange={(dates) => {
                              if (dates) {
                                handleUpdateFilter(index, 'values', [
                                  dates[0].format('YYYY-MM-DD'),
                                  dates[1].format('YYYY-MM-DD')
                                ]);
                              } else {
                                handleUpdateFilter(index, 'values', []);
                              }
                            }}
                            style={{ width: '100%' }}
                            disabled={!filter.member}
                          />
                        ) : isDateOperator ? (
                          <DatePicker
                            value={filter.values?.[0] ? dayjs(filter.values[0]) : null}
                            onChange={(date) => {
                              if (date) {
                                handleUpdateFilter(index, 'values', [date.format('YYYY-MM-DD')]);
                              } else {
                                handleUpdateFilter(index, 'values', []);
                              }
                            }}
                            style={{ width: '100%' }}
                            disabled={!filter.member}
                          />
                        ) : (
                          <Select
                            mode="tags"
                            value={filter.values || []}
                            onChange={(values) => handleUpdateFilter(index, 'values', values)}
                            placeholder="Enter values"
                            style={{ width: '100%' }}
                            disabled={!filter.member}
                            tokenSeparators={[',']}
                          />
                        )
                      )}
                      {!needsValues && (
                        <div className="filter-no-value">
                          <Tag color="default">No value needed</Tag>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <Button
                    type="text"
                    danger
                    icon={<X size={16} />}
                    onClick={() => handleRemoveFilter(index)}
                    className="filter-remove-btn"
                  />
                </div>
              );
            })}
          </div>
        )}
        
        {(query.filters || []).length > 0 && (
          <div className="filters-summary">
            <Tag color="cyan">{query.filters.length} filter{query.filters.length > 1 ? 's' : ''} applied</Tag>
          </div>
        )}
      </div>

      {/* Live Query Preview - Editable */}
      <QueryPreviewEditor 
        query={query} 
        onQueryChange={onQueryChange}
      />

      {/* Query Summary */}
      {(query.measures?.length > 0 || query.dimensions?.length > 0 || query.segments?.length > 0 || query.filters?.length > 0) && (
        <div className="query-summary">
          <Alert
            message="Query Configuration"
            description={
              <div className="text-sm">
                {query.measures?.length > 0 && (
                  <div>
                    <strong>Measures:</strong> {query.measures.length} selected
                  </div>
                )}
                {query.dimensions?.length > 0 && (
                  <div>
                    <strong>Dimensions:</strong> {query.dimensions.length} selected
                  </div>
                )}
                {currentTimeDim?.dimension && (
                  <div>
                    <strong>Time:</strong> {currentTimeDim.dimension} ({currentTimeDim.granularity})
                  </div>
                )}
                {query.segments?.length > 0 && (
                  <div>
                    <strong>Segments:</strong> {query.segments.length} selected
                  </div>
                )}
                {query.filters?.length > 0 && (
                  <div>
                    <strong>Filters:</strong> {query.filters.length} applied
                  </div>
                )}
              </div>
            }
            type="info"
            showIcon
            icon={<BarChart2 size={16} />}
          />
        </div>
      )}
    </div>
  );
};

// Query Builder Panel Component
const QueryBuilderPanel = ({ 
  queryIndex, 
  vizState, 
  onVizStateChange, 
  onRemove, 
  cubeApi,
  isExpanded,
  onToggleExpand,
  totalQueries
}) => {
  const handleQueryChange = (newQuery) => {
    onVizStateChange(queryIndex, {
      ...vizState,
      query: newQuery
    });
  };

  const handleQueryNameChange = (name) => {
    onVizStateChange(queryIndex, {
      ...vizState,
      queryName: name
    });
  };

  return (
    <Card 
      size="small"
      className="query-card"
      title={
        <div className="query-card-header">
          <span className="query-title">
            {vizState.queryName || `Query ${queryIndex + 1}`}
          </span>
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              onClick={onToggleExpand}
              title={isExpanded ? "Collapse" : "Expand"}
            />
            {totalQueries > 1 && (
              <Button 
                danger 
                size="small"
                icon={<Trash2 size={14} />}
                onClick={onRemove}
              >
                Remove
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {isExpanded ? (
        <CustomQueryBuilder
          cubeApi={cubeApi}
          query={vizState.query || {}}
          onQueryChange={handleQueryChange}
          queryName={vizState.queryName || `Query ${queryIndex + 1}`}
          onQueryNameChange={handleQueryNameChange}
        />
      ) : (
        <div className="collapsed-query-info">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <strong>Measures:</strong>{' '}
              <span className="text-gray-600">
                {vizState.query?.measures?.length > 0 
                  ? vizState.query.measures.map(m => m.split('.')[1] || m).join(', ')
                  : 'None selected'}
              </span>
            </div>
            <div>
              <strong>Dimensions:</strong>{' '}
              <span className="text-gray-600">
                {vizState.query?.dimensions?.length > 0 
                  ? vizState.query.dimensions.map(d => d.split('.')[1] || d).join(', ')
                  : 'None selected'}
              </span>
            </div>
            {vizState.query?.timeDimensions?.length > 0 && (
              <div>
                <strong>Time Dimensions:</strong>{' '}
                <span className="text-gray-600">
                  {vizState.query.timeDimensions.map(td => 
                    `${td.dimension.split('.')[1] || td.dimension}${td.granularity ? ` (${td.granularity})` : ''}`
                  ).join(', ')}
                </span>
              </div>
            )}
            {vizState.query?.segments?.length > 0 && (
              <div>
                <strong>Segments:</strong>{' '}
                <span className="text-gray-600">
                  {vizState.query.segments.map(s => s.split('.')[1] || s).join(', ')}
                </span>
              </div>
            )}
            {vizState.query?.filters?.length > 0 && (
              <div>
                <strong>Filters:</strong>{' '}
                <span className="text-gray-600">
                  {vizState.query.filters.length} filter{vizState.query.filters.length > 1 ? 's' : ''} applied
                </span>
              </div>
            )}
          </Space>
        </div>
      )}
    </Card>
  );
};

// Query Input Section - Container for all query builders
const QueryInputSection = ({ 
  queries, 
  setQueries, 
  expandedQueries, 
  setExpandedQueries,
  cubeApi
}) => {
  const addQuery = () => {
    const newQueryIndex = queries.length;
    setQueries([
      ...queries,
      { 
        id: Date.now(),
        queryName: `Query ${queries.length + 1}`,
        query: {},
        chartType: 'table'
      }
    ]);
    setExpandedQueries([...expandedQueries, newQueryIndex]);
  };

  const removeQuery = (index) => {
    if (queries.length === 1) {
      message.warning('You must have at least one query');
      return;
    }
    const newQueries = queries.filter((_, i) => i !== index);
    setQueries(newQueries);
    setExpandedQueries(
      expandedQueries
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i)
    );
  };

  const updateVizState = (index, vizState) => {
    const newQueries = [...queries];
    newQueries[index] = { ...newQueries[index], ...vizState };
    setQueries(newQueries);
  };

  const toggleExpand = (index) => {
    if (expandedQueries.includes(index)) {
      setExpandedQueries(expandedQueries.filter(i => i !== index));
    } else {
      setExpandedQueries([...expandedQueries, index]);
    }
  };

  return (
    <Card className="query-input-section" title="1. Build Your Queries">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {queries.map((query, index) => (
          <QueryBuilderPanel
            key={query.id || index}
            queryIndex={index}
            vizState={query}
            onVizStateChange={updateVizState}
            onRemove={() => removeQuery(index)}
            cubeApi={cubeApi}
            isExpanded={expandedQueries.includes(index)}
            onToggleExpand={() => toggleExpand(index)}
            totalQueries={queries.length}
          />
        ))}
        
        <Button
          type="dashed"
          onClick={addQuery}
          icon={<Plus size={16} />}
          block
        >
          Add Query
        </Button>
      </Space>
    </Card>
  );
};

// Unified Filter Panel Component
const UnifiedFilterPanel = ({ 
  queries,
  dateRange, 
  setDateRange, 
  businessIds, 
  setBusinessIds,
  unifiedFilters,
  setUnifiedFilters,
  onExecute,
  isLoading
}) => {
  // Filter operators
  const FILTER_OPERATORS = {
    string: [
      { label: 'equals', value: 'equals' },
      { label: 'not equals', value: 'notEquals' },
      { label: 'contains', value: 'contains' },
      { label: 'not contains', value: 'notContains' },
      { label: 'is set', value: 'set' },
      { label: 'is not set', value: 'notSet' },
    ],
    number: [
      { label: 'equals', value: 'equals' },
      { label: 'not equals', value: 'notEquals' },
      { label: 'greater than', value: 'gt' },
      { label: 'greater or equal', value: 'gte' },
      { label: 'less than', value: 'lt' },
      { label: 'less or equal', value: 'lte' },
      { label: 'is set', value: 'set' },
      { label: 'is not set', value: 'notSet' },
    ],
    time: [
      { label: 'in date range', value: 'inDateRange' },
      { label: 'not in date range', value: 'notInDateRange' },
      { label: 'before date', value: 'beforeDate' },
      { label: 'after date', value: 'afterDate' },
      { label: 'is set', value: 'set' },
      { label: 'is not set', value: 'notSet' },
    ],
  };

  // Extract all dimensions from all queries with their query info
  const allDimensionsByQuery = useMemo(() => {
    const result = [];
    
    queries.forEach((q, idx) => {
      const query = q.query || {};
      const queryName = q.queryName || `Query ${idx + 1}`;
      const queryDimensions = [];
      
      // Extract time dimensions
      if (query.timeDimensions) {
        query.timeDimensions.forEach(td => {
          if (td.dimension) {
            queryDimensions.push({
              dimension: td.dimension,
              shortName: td.dimension.split('.').pop(),
              type: 'time',
              granularity: td.granularity
            });
          }
        });
      }
      
      // Extract regular dimensions
      if (query.dimensions) {
        query.dimensions.forEach(dim => {
          const shortName = dim.split('.').pop();
          let type = 'string';
          if (shortName.toLowerCase().includes('id') || 
              shortName.toLowerCase().includes('count') || 
              shortName.toLowerCase().includes('amount') ||
              shortName.toLowerCase().includes('number')) {
            type = 'number';
          }
          
          queryDimensions.push({
            dimension: dim,
            shortName: shortName,
            type: type
          });
        });
      }
      
      if (queryDimensions.length > 0) {
        result.push({
          queryIndex: idx,
          queryName: queryName,
          dimensions: queryDimensions
        });
      }
    });
    
    return result;
  }, [queries]);

  // Get all time dimensions for quick date filter
  const allTimeDimensions = useMemo(() => {
    const timeDims = [];
    allDimensionsByQuery.forEach(q => {
      q.dimensions.filter(d => d.type === 'time').forEach(d => {
        timeDims.push({
          queryIndex: q.queryIndex,
          queryName: q.queryName,
          ...d
        });
      });
    });
    return timeDims;
  }, [allDimensionsByQuery]);

  const hasTimeDimensions = allTimeDimensions.length > 0;
  const hasValidQueries = queries.some(q => 
    q.query?.measures?.length > 0 || q.query?.dimensions?.length > 0
  );

  // Add a new unified filter
  const handleAddUnifiedFilter = () => {
    setUnifiedFilters([
      ...(unifiedFilters || []),
      {
        id: Date.now(),
        selectedDimensions: {}, // { queryIndex: dimensionName }
        operator: 'equals',
        values: []
      }
    ]);
  };

  // Update selected dimensions for a filter
  const handleDimensionSelect = (filterIndex, queryIndex, dimension) => {
    const newFilters = [...(unifiedFilters || [])];
    const filter = newFilters[filterIndex];
    
    if (!filter.selectedDimensions) {
      filter.selectedDimensions = {};
    }
    
    if (dimension) {
      filter.selectedDimensions[queryIndex] = dimension;
    } else {
      delete filter.selectedDimensions[queryIndex];
    }
    
    // Auto-detect type from first selected dimension
    const selectedDims = Object.values(filter.selectedDimensions);
    if (selectedDims.length > 0) {
      const firstDim = selectedDims[0];
      const dimInfo = allDimensionsByQuery
        .flatMap(q => q.dimensions)
        .find(d => d.dimension === firstDim);
      
      if (dimInfo?.type === 'time' && filter.operator === 'equals') {
        filter.operator = 'inDateRange';
      }
    }
    
    setUnifiedFilters(newFilters);
  };

  // Update filter operator
  const handleOperatorChange = (filterIndex, operator) => {
    const newFilters = [...(unifiedFilters || [])];
    newFilters[filterIndex].operator = operator;
    
    // Clear values if switching to set/notSet
    if (['set', 'notSet'].includes(operator)) {
      newFilters[filterIndex].values = [];
    }
    
    setUnifiedFilters(newFilters);
  };

  // Update filter values
  const handleValuesChange = (filterIndex, values) => {
    const newFilters = [...(unifiedFilters || [])];
    newFilters[filterIndex].values = values;
    setUnifiedFilters(newFilters);
  };

  // Remove a unified filter
  const handleRemoveUnifiedFilter = (index) => {
    setUnifiedFilters((unifiedFilters || []).filter((_, i) => i !== index));
  };

  // Get the type of selected dimensions
  const getFilterType = (filter) => {
    const selectedDims = Object.values(filter.selectedDimensions || {});
    if (selectedDims.length === 0) return 'string';
    
    const firstDim = selectedDims[0];
    const dimInfo = allDimensionsByQuery
      .flatMap(q => q.dimensions)
      .find(d => d.dimension === firstDim);
    
    return dimInfo?.type || 'string';
  };

  // Get operators for a filter based on selected dimensions
  const getOperatorsForFilter = (filter) => {
    const type = getFilterType(filter);
    if (type === 'time') return FILTER_OPERATORS.time;
    if (type === 'number') return FILTER_OPERATORS.number;
    return FILTER_OPERATORS.string;
  };

  // Quick select all matching dimensions
  const handleSelectAllMatching = (filterIndex, dimension) => {
    const newFilters = [...(unifiedFilters || [])];
    const filter = newFilters[filterIndex];
    const shortName = dimension.split('.').pop().toLowerCase().replace(/[_-]/g, '');
    
    // Find all dimensions with similar short name across queries
    allDimensionsByQuery.forEach(q => {
      const matchingDim = q.dimensions.find(d => 
        d.shortName.toLowerCase().replace(/[_-]/g, '') === shortName
      );
      if (matchingDim) {
        if (!filter.selectedDimensions) filter.selectedDimensions = {};
        filter.selectedDimensions[q.queryIndex] = matchingDim.dimension;
      }
    });
    
    setUnifiedFilters(newFilters);
  };

  return (
    <Card className="filter-panel" title="2. Set Unified Filters (Applied to All Queries)">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        
        {/* Available Dimensions Summary */}
        {allDimensionsByQuery.length > 0 && (
          <Alert
            message={`Dimensions Available from ${allDimensionsByQuery.length} Queries`}
            description={
              <div className="dimensions-by-query-summary">
                {allDimensionsByQuery.map((q, idx) => (
                  <div key={idx} className="query-dimensions-item">
                    <Tag color="blue">{q.queryName}</Tag>
                    <span className="dimension-count">
                      {q.dimensions.length} dimension{q.dimensions.length !== 1 ? 's' : ''}
                    </span>
                    <span className="dimension-list">
                      {q.dimensions.slice(0, 3).map(d => d.shortName).join(', ')}
                      {q.dimensions.length > 3 && ` +${q.dimensions.length - 3} more`}
                    </span>
                  </div>
                ))}
              </div>
            }
            type="info"
            showIcon
            icon={<Database size={16} />}
          />
        )}

        {/* Date Range - Quick access for time dimensions */}
        {hasTimeDimensions && (
          <div className="unified-filter-section">
            <div className="filter-section-title">
              <Calendar size={14} />
              <span>Date Range Filter</span>
              <Tag color="purple">{allTimeDimensions.length} Time Dimension{allTimeDimensions.length !== 1 ? 's' : ''}</Tag>
            </div>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                />
              </Col>
              <Col>
                {dateRange && (
                  <Button 
                    type="text" 
                    danger 
                    icon={<X size={14} />}
                    onClick={() => setDateRange(null)}
                  >
                    Clear
                  </Button>
                )}
              </Col>
            </Row>
            <div className="time-dimensions-list">
              {allTimeDimensions.map((td, idx) => (
                <Tag key={idx} color="purple" style={{ margin: '4px 4px 0 0' }}>
                  {td.queryName}: {td.shortName}
                </Tag>
              ))}
            </div>
          </div>
        )}

        <Divider style={{ margin: '12px 0' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Dimension Filters (Select from Multiple Queries)</span>
        </Divider>

        {/* Dynamic Unified Filters with Multi-Query Dimension Selection */}
        <div className="unified-filters-section">
          <div className="unified-filters-header">
            <span className="section-label">
              <SlidersHorizontal size={14} />
              Filter Dimensions Across Queries
            </span>
            <Button
              size="small"
              type="dashed"
              icon={<Plus size={14} />}
              onClick={handleAddUnifiedFilter}
              disabled={allDimensionsByQuery.length === 0}
            >
              Add Filter Group
            </Button>
          </div>

          {(!unifiedFilters || unifiedFilters.length === 0) ? (
            <div className="unified-filter-empty">
              <p>No filter groups added.</p>
              <p className="text-gray-400 text-sm">
                Click "Add Filter Group" to select dimensions from multiple queries and apply the same filter value to all of them.
              </p>
            </div>
          ) : (
            <div className="unified-filters-list">
              {unifiedFilters.map((filter, filterIndex) => {
                const operators = getOperatorsForFilter(filter);
                const needsValues = !['set', 'notSet'].includes(filter.operator);
                const isDateRange = ['inDateRange', 'notInDateRange'].includes(filter.operator);
                const isDateOperator = ['beforeDate', 'afterDate'].includes(filter.operator);
                const selectedCount = Object.keys(filter.selectedDimensions || {}).length;
                
                return (
                  <div key={filter.id || filterIndex} className="unified-filter-row">
                    <div className="unified-filter-header-row">
                      <span className="filter-group-title">
                        <Filter size={14} />
                        Filter Group {filterIndex + 1}
                        {selectedCount > 0 && (
                          <Tag color="green" style={{ marginLeft: 8 }}>
                            {selectedCount} dimension{selectedCount !== 1 ? 's' : ''} selected
                          </Tag>
                        )}
                      </span>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<X size={16} />}
                        onClick={() => handleRemoveUnifiedFilter(filterIndex)}
                      >
                        Remove
                      </Button>
                    </div>

                    {/* Dimension Selection per Query */}
                    <div className="dimension-selection-grid">
                      <label className="grid-label">Select Dimensions (same filter applies to all selected):</label>
                      <div className="query-dimension-selectors">
                        {allDimensionsByQuery.map((q) => (
                          <div key={q.queryIndex} className="query-dimension-selector">
                            <div className="query-selector-header">
                              <Tag color="blue">{q.queryName}</Tag>
                              {filter.selectedDimensions?.[q.queryIndex] && (
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => {
                                    handleSelectAllMatching(filterIndex, filter.selectedDimensions[q.queryIndex]);
                                  }}
                                  style={{ fontSize: 11, padding: 0 }}
                                >
                                  Select similar in all queries
                                </Button>
                              )}
                            </div>
                            <Select
                              value={filter.selectedDimensions?.[q.queryIndex] || undefined}
                              onChange={(value) => handleDimensionSelect(filterIndex, q.queryIndex, value)}
                              placeholder="Select dimension"
                              style={{ width: '100%' }}
                              allowClear
                              showSearch
                              filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                              }
                              options={q.dimensions.map(d => ({
                                label: (
                                  <span>
                                    {d.shortName}
                                    <Tag 
                                      color={d.type === 'time' ? 'purple' : d.type === 'number' ? 'blue' : 'default'} 
                                      style={{ marginLeft: 8, fontSize: 10 }}
                                    >
                                      {d.type}
                                    </Tag>
                                  </span>
                                ),
                                value: d.dimension,
                                searchLabel: d.shortName
                              }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Operator and Values */}
                    {selectedCount > 0 && (
                      <div className="filter-operator-values">
                        <div className="filter-field-row">
                          <div className="filter-field-item">
                            <label>Operator</label>
                            <Select
                              value={filter.operator}
                              onChange={(value) => handleOperatorChange(filterIndex, value)}
                              style={{ width: '100%' }}
                              options={operators}
                            />
                          </div>
                          
                          <div className="filter-field-item filter-values-field">
                            <label>Value(s)</label>
                            {needsValues ? (
                              isDateRange ? (
                                <RangePicker
                                  value={filter.values?.length === 2 ? [
                                    dayjs(filter.values[0]),
                                    dayjs(filter.values[1])
                                  ] : null}
                                  onChange={(dates) => {
                                    if (dates) {
                                      handleValuesChange(filterIndex, [
                                        dates[0].format('YYYY-MM-DD'),
                                        dates[1].format('YYYY-MM-DD')
                                      ]);
                                    } else {
                                      handleValuesChange(filterIndex, []);
                                    }
                                  }}
                                  style={{ width: '100%' }}
                                />
                              ) : isDateOperator ? (
                                <DatePicker
                                  value={filter.values?.[0] ? dayjs(filter.values[0]) : null}
                                  onChange={(date) => {
                                    if (date) {
                                      handleValuesChange(filterIndex, [date.format('YYYY-MM-DD')]);
                                    } else {
                                      handleValuesChange(filterIndex, []);
                                    }
                                  }}
                                  style={{ width: '100%' }}
                                />
                              ) : (
                                <Select
                                  mode="tags"
                                  value={filter.values || []}
                                  onChange={(values) => handleValuesChange(filterIndex, values)}
                                  placeholder="Enter values (press Enter or comma to add)"
                                  style={{ width: '100%' }}
                                  tokenSeparators={[',']}
                                />
                              )
                            ) : (
                              <div className="filter-no-value-indicator">
                                <Tag>No value needed</Tag>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Selected Dimensions Summary */}
                    {selectedCount > 0 && (
                      <div className="selected-dimensions-summary">
                        <span className="summary-label">This filter will apply to:</span>
                        <div className="selected-dims-tags">
                          {Object.entries(filter.selectedDimensions || {}).map(([queryIdx, dim]) => {
                            const queryInfo = allDimensionsByQuery.find(q => q.queryIndex === parseInt(queryIdx));
                            return (
                              <Tag key={queryIdx} color="green" closable onClose={() => {
                                handleDimensionSelect(filterIndex, parseInt(queryIdx), null);
                              }}>
                                {queryInfo?.queryName}: {dim.split('.').pop()}
                              </Tag>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* Filter Summary */}
        {(dateRange || (unifiedFilters && unifiedFilters.some(f => Object.keys(f.selectedDimensions || {}).length > 0))) && (
          <Alert
            message="Unified Filters Summary"
            description={
              <div className="filter-summary-content">
                {dateRange && (
                  <div className="filter-summary-item">
                    <CheckCircle size={14} className="text-green-600" />
                    <strong>Date Range:</strong> 
                    <span>{dateRange[0].format('YYYY-MM-DD')} to {dateRange[1].format('YYYY-MM-DD')}</span>
                    <span className="text-gray-500 text-xs">
                      ({allTimeDimensions.length} time dimension{allTimeDimensions.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
                {unifiedFilters && unifiedFilters
                  .filter(f => Object.keys(f.selectedDimensions || {}).length > 0 && f.values?.length > 0)
                  .map((filter, idx) => {
                    const dimCount = Object.keys(filter.selectedDimensions || {}).length;
                    return (
                      <div key={idx} className="filter-summary-item">
                        <CheckCircle size={14} className="text-green-600" />
                        <strong>Filter Group {idx + 1}:</strong>
                        <span>{filter.operator} {filter.values.join(', ')}</span>
                        <span className="text-gray-500 text-xs">
                          ({dimCount} dimension{dimCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                    );
                  })}
              </div>
            }
            type="success"
            showIcon
          />
        )}

        <Button
          type="primary"
          size="large"
          icon={<Play size={18} />}
          onClick={onExecute}
          loading={isLoading}
          block
          disabled={!hasValidQueries || (hasTimeDimensions && !dateRange)}
        >
          Execute {queries.length} {queries.length === 1 ? 'Query' : 'Queries'} & Merge Results
        </Button>

        {!hasValidQueries && (
          <Alert
            message="No valid queries"
            description="Please add at least one measure or dimension to your queries"
            type="warning"
            showIcon
          />
        )}

        {!dateRange && hasTimeDimensions && (
          <Alert
            message="Date Range is required when queries have time dimensions"
            type="warning"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

// Manual Dimension Mapping Component
const ManualDimensionMapping = ({ queries, dimensionMappings, setDimensionMappings }) => {
  const [allDimensions, setAllDimensions] = useState({});

  // Extract all dimensions from all queries
  useEffect(() => {
    const dimensionsByQuery = {};

    queries.forEach((q, idx) => {
      const query = q.query || {};
      const dims = [];
      
      // Add time dimensions
      if (query.timeDimensions) {
        query.timeDimensions.forEach(td => {
          if (td.dimension) {
            dims.push({ dimension: td.dimension, type: 'time' });
          }
        });
      }
      
      // Add regular dimensions
      if (query.dimensions) {
        query.dimensions.forEach(dim => {
          dims.push({ dimension: dim, type: 'regular' });
        });
      }
      
      if (dims.length > 0) {
        dimensionsByQuery[idx] = {
          queryName: q.queryName || `Query ${idx + 1}`,
          dimensions: dims
        };
      }
    });

    setAllDimensions(dimensionsByQuery);
  }, [queries]);

  const addMapping = () => {
    setDimensionMappings([
      ...dimensionMappings,
      { id: Date.now(), mappings: {}, alias: '' }
    ]);
  };

  const removeMapping = (id) => {
    setDimensionMappings(dimensionMappings.filter(m => m.id !== id));
  };

  const updateMapping = (mappingId, queryIndex, dimension) => {
    setDimensionMappings(dimensionMappings.map(m => {
      if (m.id === mappingId) {
        return {
          ...m,
          mappings: {
            ...m.mappings,
            [queryIndex]: dimension
          }
        };
      }
      return m;
    }));
  };

  const updateAlias = (mappingId, alias) => {
    setDimensionMappings(dimensionMappings.map(m => {
      if (m.id === mappingId) {
        return { ...m, alias };
      }
      return m;
    }));
  };

  const getMappingName = (mapping) => {
    if (mapping.alias) return mapping.alias;
    const dims = Object.values(mapping.mappings).filter(Boolean);
    if (dims.length === 0) return 'Unmapped';
    return dims[0].split('.')[1] || dims[0];
  };

  if (queries.length < 2) {
    return (
      <Card className="merge-config" title="3. Dimension Mapping for Merge">
        <Alert
          message="Single Query Detected"
          description="Add more queries to enable dimension mapping and merging."
          type="info"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card className="merge-config" title="3. Map Dimensions for Merging">
      <Alert
        message="Manual Dimension Mapping"
        description="Map dimensions with different names across queries to merge results. Results will be merged using FULL OUTER JOIN - all rows from all queries will be included, with missing values filled with 0."
        type="info"
        showIcon
        icon={<Link size={16} />}
        className="mb-4"
      />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {dimensionMappings.map((mapping, idx) => (
          <Card
            key={mapping.id}
            type="inner"
            size="small"
            title={
              <div className="flex justify-between items-center">
                <span>Mapping Group {idx + 1}: {getMappingName(mapping)}</span>
                <Button
                  danger
                  size="small"
                  icon={<Trash2 size={14} />}
                  onClick={() => removeMapping(mapping.id)}
                >
                  Remove
                </Button>
              </div>
            }
          >
            <Row gutter={16}>
              {Object.keys(allDimensions).map((queryIdx) => {
                const queryInfo = allDimensions[queryIdx];
                return (
                  <Col key={queryIdx} xs={24} md={12} lg={8}>
                    <div className="filter-field">
                      <label className="filter-label">
                        <Tag color="blue">{queryInfo.queryName}</Tag>
                      </label>
                      <Select
                        value={mapping.mappings[queryIdx]}
                        onChange={(value) => updateMapping(mapping.id, queryIdx, value)}
                        style={{ width: '100%' }}
                        placeholder="Select dimension"
                        allowClear
                      >
                        {queryInfo.dimensions.map((dim) => (
                          <Select.Option key={dim.dimension} value={dim.dimension}>
                            <Space>
                              {dim.type === 'time' && <Calendar size={12} className="text-purple-500" />}
                              {dim.type === 'regular' && <Database size={12} className="text-blue-500" />}
                              {dim.dimension}
                            </Space>
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                );
              })}
              
              {/* Alias/Rename Field */}
              <Col xs={24} md={12} lg={8}>
                <div className="filter-field">
                  <label className="filter-label">
                    <Tag color="cyan">Column Name (Optional)</Tag>
                  </label>
                  <Input
                    value={mapping.alias || ''}
                    onChange={(e) => updateAlias(mapping.id, e.target.value)}
                    placeholder="Custom column name"
                    allowClear
                  />
                </div>
              </Col>
            </Row>
          </Card>
        ))}

        <Button
          type="dashed"
          onClick={addMapping}
          icon={<Plus size={16} />}
          block
        >
          Add Dimension Mapping
        </Button>

        {dimensionMappings.length > 0 && (
          <Alert
            message="Merge Configuration"
            description={
              <div>
                <p className="mb-2">Results will be merged on the following mapped dimensions:</p>
                {dimensionMappings.map((mapping, idx) => {
                  const mappedDims = Object.entries(mapping.mappings)
                    .filter(([_, dim]) => dim)
                    .map(([queryIdx, dim]) => `${allDimensions[queryIdx]?.queryName}: ${dim}`);
                  
                  if (mappedDims.length === 0) return null;
                  
                  return (
                    <div key={idx} className="mb-2">
                      <strong>Group {idx + 1}{mapping.alias ? ` → "${mapping.alias}"` : ''}:</strong>
                      <div className="ml-4 text-sm">
                        {mappedDims.map((dim, i) => (
                          <div key={i}>• {dim}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            type="success"
            showIcon
          />
        )}

        {dimensionMappings.length === 0 && (
          <Alert
            message="No Dimension Mappings"
            description="Add dimension mappings to merge query results. Without mappings, queries will be displayed separately."
            type="warning"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

// Column Rename Component - For Measure Columns
const ColumnRenameSection = ({ queries, columnAliases, setColumnAliases }) => {
  const [measureColumns, setMeasureColumns] = useState([]);

  // Detect all measure columns that will appear in the output
  useEffect(() => {
    const columns = [];

    // Add measure columns from each query
    queries.forEach((q, idx) => {
      const queryName = q.queryName || `Query ${idx + 1}`;
      
      // Add measures
      (q.query?.measures || []).forEach(measure => {
        const columnKey = idx === 0 ? measure : `${queryName}.${measure}`;
        const shortName = measure.split('.').pop() || measure;
        columns.push({
          key: columnKey,
          source: queryName,
          measure: measure,
          defaultName: shortName
        });
      });
    });

    setMeasureColumns(columns);
  }, [queries]);

  const handleAliasChange = (columnKey, alias) => {
    if (alias.trim() === '') {
      const newAliases = { ...columnAliases };
      delete newAliases[columnKey];
      setColumnAliases(newAliases);
    } else {
      setColumnAliases({
        ...columnAliases,
        [columnKey]: alias
      });
    }
  };

  const clearAllAliases = () => {
    setColumnAliases({});
  };

  if (measureColumns.length === 0) {
    return null;
  }

  const hasAliases = Object.keys(columnAliases).length > 0;

  return (
    <Card 
      className="column-rename-section" 
      title={
        <div className="section-header-with-action">
          <span><Edit3 size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />4. Rename Measure Columns (Optional)</span>
          {hasAliases && (
            <Button size="small" onClick={clearAllAliases}>
              Clear All
            </Button>
          )}
        </div>
      }
    >
      <Alert
        message="Customize Measure Names"
        description="Set custom display names for measure columns in the output table. Dimension names can be customized in the mapping section above."
        type="info"
        showIcon
        className="mb-4"
      />

      <Row gutter={[16, 16]}>
        {measureColumns.map((col) => (
          <Col key={col.key} xs={24} sm={12} lg={8}>
            <div className="column-rename-item">
              <div className="column-info">
                <Tag color="blue">{col.source}</Tag>
                <code className="original-column-name">{col.defaultName}</code>
              </div>
              <Input
                size="small"
                placeholder={`Rename "${col.defaultName}"`}
                value={columnAliases[col.key] || ''}
                onChange={(e) => handleAliasChange(col.key, e.target.value)}
                allowClear
                prefix={<span className="input-prefix">→</span>}
              />
            </div>
          </Col>
        ))}
      </Row>

      {hasAliases && (
        <Alert
          message="Active Renames"
          description={
            <div className="alias-summary">
              {Object.entries(columnAliases).map(([key, alias]) => (
                <Tag key={key} color="green" className="alias-tag">
                  {key.split('.').pop()} → <strong>{alias}</strong>
                </Tag>
              ))}
            </div>
          }
          type="success"
          showIcon
          className="mt-4"
        />
      )}
    </Card>
  );
};

// Results Display Component
const ResultsDisplay = ({ results, onExport, isLoading, executionSummary, columnAliases = {}, dimensionMappings = [], queries = [] }) => {
  const [viewType, setViewType] = useState('table');
  const [selectedDimension, setSelectedDimension] = useState(null);
  const [selectedMeasures, setSelectedMeasures] = useState([]);

  // Build dimension alias map from mappings
  const dimensionAliasMap = useMemo(() => {
    const map = {};
    dimensionMappings.forEach(mapping => {
      const firstQueryDim = mapping.mappings[0];
      if (firstQueryDim && mapping.alias) {
        map[firstQueryDim] = mapping.alias;
      }
    });
    return map;
  }, [dimensionMappings]);

  // Detect dimensions and measures from queries metadata and results
  const { dimensionKeys, measureKeys } = useMemo(() => {
    if (!results || results.length === 0) return { dimensionKeys: [], measureKeys: [] };
    
    const allKeys = Object.keys(results[0]);
    
    // Get known measures from query definitions
    const knownMeasures = new Set();
    queries.forEach((q, idx) => {
      const queryName = q.queryName || `Query ${idx + 1}`;
      (q.query?.measures || []).forEach(measure => {
        // Add both the original key and prefixed version
        knownMeasures.add(measure);
        if (idx > 0) {
          knownMeasures.add(`${queryName}.${measure}`);
        }
      });
    });

    // Get known dimensions from query definitions
    const knownDimensions = new Set();
    queries.forEach((q) => {
      (q.query?.dimensions || []).forEach(dim => knownDimensions.add(dim));
      (q.query?.timeDimensions || []).forEach(td => {
        if (td.dimension) knownDimensions.add(td.dimension);
      });
    });

    // Also add mapped dimensions
    dimensionMappings.forEach(mapping => {
      Object.values(mapping.mappings).forEach(dim => {
        if (dim) knownDimensions.add(dim);
      });
    });

    const dims = [];
    const measures = [];
    
    allKeys.forEach(key => {
      // Check if this key matches a known measure (with or without prefix)
      const isMeasure = knownMeasures.has(key) || 
        Array.from(knownMeasures).some(m => key.endsWith(m) || key.includes(`.${m.split('.').pop()}`));
      
      // Check if this key matches a known dimension
      const isDimension = knownDimensions.has(key) ||
        Array.from(knownDimensions).some(d => key.startsWith(d) || key.includes(d.split('.').pop()));

      if (isMeasure && !isDimension) {
        measures.push(key);
      } else if (isDimension) {
        dims.push(key);
      } else {
        // Fallback: check the actual data type
        const sampleValues = results.slice(0, 5).map(r => r[key]).filter(v => v != null);
        const allNumbers = sampleValues.length > 0 && sampleValues.every(v => typeof v === 'number');
        
        if (allNumbers) {
          measures.push(key);
        } else {
          dims.push(key);
        }
      }
    });
    
    return { dimensionKeys: dims, measureKeys: measures };
  }, [results, queries, dimensionMappings]);

  // Auto-select first dimension and all measures when results change
  useEffect(() => {
    if (dimensionKeys.length > 0) {
      setSelectedDimension(prev => prev && dimensionKeys.includes(prev) ? prev : dimensionKeys[0]);
    }
    if (measureKeys.length > 0) {
      setSelectedMeasures(prev => {
        if (prev.length > 0 && prev.every(m => measureKeys.includes(m))) {
          return prev;
        }
        return measureKeys;
      });
    }
  }, [dimensionKeys, measureKeys]);

  const getDisplayName = useCallback((key) => {
    if (dimensionAliasMap[key]) return dimensionAliasMap[key];
    if (columnAliases[key]) return columnAliases[key];
    let name = key;
    name = name.replace(/^Query \d+\./, '');
    name = name.replace(/^[a-z_]+\./i, '');
    name = name.replace(/\.(day|month|year|week|hour)$/, '');
    return name;
  }, [dimensionAliasMap, columnAliases]);

  if (isLoading) {
    return (
      <Card className="results-section">
        <div className="loading-state">
          <Spin size="large" />
          <p className="mt-4">Executing queries with filters and merging results...</p>
        </div>
      </Card>
    );
  }

  if (!results || results.length === 0) {
    return (
      <Card className="results-section" title="5. Results">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Results Yet</h3>
          <p>Build your queries, set filters, and click "Execute Queries & Merge Results"</p>
        </div>
      </Card>
    );
  }

  // Get all column keys from the first row
  const allColumns = Object.keys(results[0] || {});
  
  // Build columns for the table
  const columns = allColumns.map(key => {
    let displayTitle = dimensionAliasMap[key] || columnAliases[key];
    
    if (!displayTitle) {
      displayTitle = key;
      const prefixPatterns = [/^Query \d+\./, /^[a-z_]+\./i];
      for (const pattern of prefixPatterns) {
        displayTitle = displayTitle.replace(pattern, '');
      }
      displayTitle = displayTitle.replace(/\.(day|month|year|week|hour)$/, '');
    }
    
    return {
      title: displayTitle,
      dataIndex: key,
      key: key,
      sorter: (a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return aVal - bVal;
        }
        return String(aVal || '').localeCompare(String(bVal || ''));
      },
      ellipsis: true,
      width: 150,
      render: (text) => {
        if (text === null || text === undefined) {
          return <span className="null-value">-</span>;
        }
        if (typeof text === 'string' && text.includes('T') && text.includes('-')) {
          return text.split('T')[0];
        }
        if (typeof text === 'number') {
          return text.toLocaleString();
        }
        return String(text);
      }
    };
  });

  const chartOptions = [
    { label: <span><Table2 size={16} /> Table</span>, value: 'table' },
    { label: <span><BarChart2 size={16} /> Bar</span>, value: 'bar' },
    { label: <span><TrendingUp size={16} /> Line</span>, value: 'line' },
    { label: <span><AreaChart size={16} /> Area</span>, value: 'area' },
    { label: <span><PieChart size={16} /> Pie</span>, value: 'pie' },
  ];

  const handleMeasureSelect = (values) => {
    console.log('Selected measures:', values);
    setSelectedMeasures(values || []);
  };

  const handleDimensionSelect = (value) => {
    console.log('Selected dimension:', value);
    setSelectedDimension(value);
  };

  return (
    <Card 
      className="results-section" 
      title={
        <div className="results-header">
          <div>
            <span>5. Merged Results</span>
            <span className="row-count">{results.length} rows</span>
          </div>
          <Space>
            <Button
              icon={<Download size={16} />}
              onClick={() => onExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              icon={<FileJson size={16} />}
              onClick={() => onExport('json')}
            >
              Export JSON
            </Button>
          </Space>
        </div>
      }
    >
      {executionSummary && (
        <Alert
          message="Execution Summary"
          description={
            <div className="text-sm">
              <div>✓ Executed {executionSummary.queriesExecuted} queries successfully</div>
              <div>✓ Applied filters to all time and business dimensions</div>
              {executionSummary.mergedOn && (
                <div>✓ Merged results on: {executionSummary.mergedOn}</div>
              )}
              <div>✓ Retrieved {results.length} rows</div>
            </div>
          }
          type="success"
          showIcon
          className="mb-4"
        />
      )}

      {/* Visualization Type Selector */}
      <div className="visualization-controls">
        <div className="chart-type-selector">
          <label className="control-label">Visualization:</label>
          <Segmented
            options={chartOptions}
            value={viewType}
            onChange={setViewType}
          />
        </div>

        {viewType !== 'table' && (
          <div className="chart-config">
            <div className="config-item">
              <label className="control-label">X-Axis (Dimension):</label>
              <Select
                value={selectedDimension}
                onChange={handleDimensionSelect}
                style={{ width: 250 }}
                placeholder="Select dimension for X-axis"
                options={dimensionKeys.map(k => ({ 
                  label: getDisplayName(k), 
                  value: k 
                }))}
              />
            </div>
            
            <div className="config-item">
              <label className="control-label">Y-Axis (Measures):</label>
              <Select
                mode="multiple"
                value={selectedMeasures}
                onChange={handleMeasureSelect}
                style={{ width: 350 }}
                placeholder="Select measures for Y-axis"
                maxTagCount={2}
                options={measureKeys.map(k => ({ 
                  label: getDisplayName(k), 
                  value: k 
                }))}
              />
            </div>

            {/* Debug info */}
            {measureKeys.length === 0 && (
              <Alert
                message="No measures detected"
                description="The system couldn't automatically detect measure columns. All columns appear to be dimensions."
                type="warning"
                showIcon
                style={{ marginLeft: 16 }}
              />
            )}
          </div>
        )}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* Render Table or Chart */}
      {viewType === 'table' ? (
        <Table
          dataSource={results}
          columns={columns}
          rowKey={(_, index) => index}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            showTotal: (total) => `Total ${total} rows`
          }}
          scroll={{ x: true }}
          bordered
          size="small"
        />
      ) : (
        <div className="chart-container">
          {selectedDimension && selectedMeasures.length > 0 ? (
            <D3Chart
              data={results}
              chartType={viewType}
              dimensionKey={selectedDimension}
              measureKeys={selectedMeasures}
              columnAliases={columnAliases}
              dimensionAliasMap={dimensionAliasMap}
            />
          ) : (
            <Alert
              message="Configure Chart"
              description={
                <div>
                  <p>Please select options to render the chart:</p>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {!selectedDimension && <li>Select a dimension for X-axis ({dimensionKeys.length} available)</li>}
                    {selectedMeasures.length === 0 && <li>Select at least one measure for Y-axis ({measureKeys.length} available)</li>}
                  </ul>
                  {dimensionKeys.length > 0 && (
                    <p style={{ marginTop: 8 }}>
                      <strong>Available dimensions:</strong> {dimensionKeys.map(k => getDisplayName(k)).join(', ')}
                    </p>
                  )}
                  {measureKeys.length > 0 && (
                    <p style={{ marginTop: 8 }}>
                      <strong>Available measures:</strong> {measureKeys.map(k => getDisplayName(k)).join(', ')}
                    </p>
                  )}
                </div>
              }
              type="info"
              showIcon
            />
          )}
        </div>
      )}
    </Card>
  );
};

// Main Component
const SmartQueryExecutorContent = ({ cubeApi }) => {
  const [queries, setQueries] = useState([
    { 
      id: Date.now(),
      queryName: 'Query 1',
      query: {},
      chartType: 'table'
    }
  ]);
  const [expandedQueries, setExpandedQueries] = useState([0]);
  const [dateRange, setDateRange] = useState(null);
  const [businessIds, setBusinessIds] = useState([]);
  const [unifiedFilters, setUnifiedFilters] = useState([]);
  const [dimensionMappings, setDimensionMappings] = useState([]);
  const [columnAliases, setColumnAliases] = useState({});
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [executionSummary, setExecutionSummary] = useState(null);

  const executeQueries = async () => {
    const validQueries = queries.filter(q => 
      q.query?.measures?.length > 0 || q.query?.dimensions?.length > 0
    );

    if (validQueries.length === 0) {
      message.error('Please add at least one measure or dimension to your queries');
      return;
    }

    const hasTimeDimensions = validQueries.some(q => q.query?.timeDimensions?.length > 0);
    if (hasTimeDimensions && !dateRange) {
      message.error('Please select a date range');
      return;
    }

    setIsLoading(true);
    setResults(null);
    setExecutionSummary(null);

    try {
      const modifiedQueries = validQueries.map((q, qIdx) => {
        const modifiedQuery = JSON.parse(JSON.stringify(q.query));
        
        // Apply date range to time dimensions
        if (dateRange && modifiedQuery.timeDimensions) {
          modifiedQuery.timeDimensions = modifiedQuery.timeDimensions.map(td => ({
            ...td,
            dateRange: [
              dateRange[0].format('YYYY-MM-DD'),
              dateRange[1].format('YYYY-MM-DD')
            ]
          }));
        }

        // Apply unified filters - now with explicit dimension selection per query
        const filters = modifiedQuery.filters || [];
        
        // Find the original query index (before filtering)
        const originalQueryIndex = queries.findIndex(orig => orig.id === q.id);
        
        (unifiedFilters || []).forEach(filter => {
          // Check if this filter has a selected dimension for this query
          const selectedDim = filter.selectedDimensions?.[originalQueryIndex];
          
          if (selectedDim && filter.values?.length > 0) {
            filters.push({
              member: selectedDim,
              operator: filter.operator,
              values: filter.values
            });
          }
        });

        // Legacy: Apply business ID filters (keeping for backward compatibility)
        if (businessIds.length > 0 && modifiedQuery.dimensions) {
          modifiedQuery.dimensions.forEach(dim => {
            if (dim.toLowerCase().includes('business') || 
                dim.toLowerCase().includes('customer') ||
                dim.toLowerCase().includes('id')) {
              // Check if not already filtered by unified filters
              const alreadyFiltered = filters.some(f => f.member === dim);
              if (!alreadyFiltered) {
                filters.push({
                  member: dim,
                  operator: 'equals',
                  values: businessIds
                });
              }
            }
          });
        }
        
        if (filters.length > 0) {
          modifiedQuery.filters = filters;
        }

        return { name: q.queryName, query: modifiedQuery, id: q.id };
      });

      console.log('Executing queries with unified filters:', modifiedQueries);

      const queryResults = await Promise.all(
        modifiedQueries.map(({ query }) => cubeApi.load(query))
      );

      const tableData = queryResults.map((result, idx) => ({
        name: modifiedQueries[idx].name,
        queryIndex: idx,
        data: result.tablePivot()
      }));

      let finalResults;
      let mergedOn = null;

      if (dimensionMappings.length > 0 && tableData.length > 1) {
        finalResults = mergeResultsWithMapping(tableData, dimensionMappings);
        mergedOn = dimensionMappings.length + ' dimension mapping(s)';
      } else if (tableData.length === 1) {
        finalResults = tableData[0].data;
      } else {
        finalResults = tableData.flatMap(({ name, data }) => 
          data.map(row => ({ ...row, _source_query: name }))
        );
      }

      setResults(finalResults);
      setExecutionSummary({
        queriesExecuted: validQueries.length,
        mergedOn: mergedOn,
        unifiedFiltersApplied: unifiedFilters?.filter(f => 
          Object.keys(f.selectedDimensions || {}).length > 0 && f.values?.length > 0
        ).length || 0
      });

      message.success(
        `Successfully executed ${validQueries.length} queries and retrieved ${finalResults.length} rows`
      );
    } catch (err) {
      console.error('Error executing queries:', err);
      message.error(`Error: ${err.message || 'Failed to execute queries'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const mergeResultsWithMapping = (tableData, mappings) => {
    if (tableData.length === 0) return [];
    if (tableData.length === 1) return tableData[0].data;

    console.log('=== MERGE DEBUG START ===');
    console.log('Mappings:', JSON.stringify(mappings, null, 2));

    // Helper to check if a column is a mapped dimension (including with suffixes)
    const isMappedDimension = (column, queryIndex) => {
      const suffixes = ['', '.day', '.month', '.year', '.week', '.hour'];
      
      for (const mapping of mappings) {
        const dim = mapping.mappings[queryIndex];
        if (!dim) continue;
        
        // Check if column matches the dimension with any suffix
        for (const suffix of suffixes) {
          if (column === dim + suffix || column === dim) {
            return true;
          }
        }
      }
      return false;
    };

    // Helper to get the base dimension name (without suffix)
    const getBaseDimension = (column) => {
      const suffixes = ['.day', '.month', '.year', '.week', '.hour'];
      for (const suffix of suffixes) {
        if (column.endsWith(suffix)) {
          return column.slice(0, -suffix.length);
        }
      }
      return column;
    };

    const getCompositeKey = (row, queryIndex) => {
      const keyParts = mappings.map(mapping => {
        const dim = mapping.mappings[queryIndex];
        if (!dim) return null;
        
        let val = row[dim];
        
        // Try with suffixes if not found
        if (val === undefined) {
          const suffixes = ['.day', '.month', '.year', '.week', '.hour'];
          for (const suffix of suffixes) {
            const dimWithSuffix = dim + suffix;
            if (row[dimWithSuffix] !== undefined) {
              val = row[dimWithSuffix];
              break;
            }
          }
        }
        
        // Extract date part if it's a datetime string
        if (val && typeof val === 'string' && val.includes('T')) {
          val = val.split('T')[0];
        }
        
        return val != null ? String(val) : null;
      }).filter(k => k !== null);
      
      return keyParts.join('|');
    };

    const measureColumnsByQuery = tableData.map(({ data, queryIndex, name }) => {
      if (data.length === 0) return { queryIndex, name, measures: [] };
      
      // Get all columns that are NOT mapped dimensions
      const measures = Object.keys(data[0]).filter(key => !isMappedDimension(key, queryIndex));
      console.log(`Query ${queryIndex} (${name}) - Measures:`, measures);
      console.log(`Query ${queryIndex} (${name}) - All columns:`, Object.keys(data[0]));
      
      return { queryIndex, name, measures };
    });

    const dataByKey = new Map();

    tableData.forEach(({ data, queryIndex, name }, idx) => {
      console.log(`\n=== Processing Query ${idx} (${name}) - ${data.length} rows ===`);

      data.forEach((row) => {
        const key = getCompositeKey(row, queryIndex);
        if (!key) return;

        console.log(`  Key: "${key}"`);

        if (!dataByKey.has(key)) {
          const newEntry = {};
          
          // Set dimension values using Query 1's dimension names
          mappings.forEach(mapping => {
            const firstQueryDim = mapping.mappings[0];
            const currentQueryDim = mapping.mappings[queryIndex];
            
            if (firstQueryDim && currentQueryDim) {
              let val = row[currentQueryDim];
              
              // Try with suffixes
              if (val === undefined) {
                const suffixes = ['.day', '.month', '.year', '.week', '.hour'];
                for (const suffix of suffixes) {
                  const dimWithSuffix = currentQueryDim + suffix;
                  if (row[dimWithSuffix] !== undefined) {
                    val = row[dimWithSuffix];
                    break;
                  }
                }
              }
              
              if (val !== undefined) {
                // Extract date part for datetime values
                if (val && typeof val === 'string' && val.includes('T')) {
                  val = val.split('T')[0];
                }
                newEntry[firstQueryDim] = val;
              }
            }
          });
          
          dataByKey.set(key, newEntry);
        }

        const entry = dataByKey.get(key);

        // Add measure values (only non-dimension columns)
        Object.keys(row).forEach(column => {
          // Skip if this column is a mapped dimension
          if (isMappedDimension(column, queryIndex)) {
            return;
          }
          
          const columnName = idx === 0 ? column : `${name}.${column}`;
          const rawValue = row[column];
          
          // Only parse as number if it's actually a number
          let value;
          if (typeof rawValue === 'number') {
            value = rawValue;
          } else if (typeof rawValue === 'string' && !isNaN(rawValue) && rawValue.trim() !== '') {
            value = parseFloat(rawValue);
          } else {
            value = rawValue; // Keep as-is for non-numeric values
          }
          
          if (entry[columnName] !== undefined && typeof value === 'number' && typeof entry[columnName] === 'number') {
            entry[columnName] = entry[columnName] + value;
          } else {
            entry[columnName] = value;
          }
          
          console.log(`    Measure ${columnName}: ${value}`);
        });
      });
    });

    console.log(`\n=== Map has ${dataByKey.size} unique keys ===`);

    // Fill missing measures with 0
    const result = [];
    
    dataByKey.forEach((entry) => {
      tableData.forEach(({ name }, idx) => {
        const measures = measureColumnsByQuery[idx].measures;
        
        const hasDataForThisQuery = measures.some(measure => {
          const columnName = idx === 0 ? measure : `${name}.${measure}`;
          return entry[columnName] !== undefined;
        });

        if (!hasDataForThisQuery) {
          measures.forEach(measure => {
            const columnName = idx === 0 ? measure : `${name}.${measure}`;
            entry[columnName] = 0;
          });
        }
      });
      
      result.push(entry);
    });

    // Sort by first dimension
    result.sort((a, b) => {
      const firstDim = mappings[0]?.mappings[0];
      if (!firstDim) return 0;
      
      const aVal = String(a[firstDim] || '');
      const bVal = String(b[firstDim] || '');
      return aVal.localeCompare(bVal);
    });

    console.log('\n=== Final Result ===');
    console.log(`Total rows: ${result.length}`);
    if (result.length > 0) {
      console.log('Columns:', Object.keys(result[0]));
      console.log('First row:', result[0]);
    }
    console.log('=== MERGE DEBUG END ===\n');

    return result;
  };

  const handleExport = (format) => {
    if (!results || results.length === 0) {
      message.warning('No results to export');
      return;
    }

    // Build dimension alias map from mappings
    const dimensionAliasMap = {};
    dimensionMappings.forEach(mapping => {
      const firstQueryDim = mapping.mappings[0];
      if (firstQueryDim && mapping.alias) {
        dimensionAliasMap[firstQueryDim] = mapping.alias;
      }
    });

    // Function to get display name for a column
    const getDisplayName = (key) => {
      // Check dimension alias first
      if (dimensionAliasMap[key]) return dimensionAliasMap[key];
      // Then check measure alias
      if (columnAliases[key]) return columnAliases[key];
      // Default: clean up the name
      let displayName = key;
      displayName = displayName.replace(/^Query \d+\./, '');
      displayName = displayName.replace(/^[a-z_]+\./i, '');
      displayName = displayName.replace(/\.(day|month|year|week|hour)$/, '');
      return displayName;
    };

    if (format === 'csv') {
      const headers = Object.keys(results[0]);
      const displayHeaders = headers.map(h => getDisplayName(h));
      
      const csv = [
        displayHeaders.join(','),
        ...results.map(row => 
          headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-results-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('CSV exported!');
    } else {
      // For JSON, transform keys to display names
      const transformedResults = results.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => {
          newRow[getDisplayName(key)] = row[key];
        });
        return newRow;
      });

      const blob = new Blob([JSON.stringify(transformedResults, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-results-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('JSON exported!');
    }
  };

  return (
    <div className="query-executor">
      <div className="executor-header">
        <div>
          <h1>Smart Query Executor</h1>
          <p>Build queries → Map dimensions → Set filters → Execute & merge</p>
        </div>
        <Button
          icon={<RefreshCw size={16} />}
          onClick={() => {
            setDateRange(null);
            setBusinessIds([]);
            setResults(null);
            setExecutionSummary(null);
          }}
        >
          Reset Filters
        </Button>
      </div>

      <div className="executor-body">
        <QueryInputSection 
          queries={queries} 
          setQueries={setQueries}
          expandedQueries={expandedQueries}
          setExpandedQueries={setExpandedQueries}
          cubeApi={cubeApi}
        />

        <UnifiedFilterPanel
          queries={queries}
          dateRange={dateRange}
          setDateRange={setDateRange}
          businessIds={businessIds}
          setBusinessIds={setBusinessIds}
          unifiedFilters={unifiedFilters}
          setUnifiedFilters={setUnifiedFilters}
          onExecute={executeQueries}
          isLoading={isLoading}
        />

        <ManualDimensionMapping
          queries={queries}
          dimensionMappings={dimensionMappings}
          setDimensionMappings={setDimensionMappings}
        />

        <ColumnRenameSection
          queries={queries}
          columnAliases={columnAliases}
          setColumnAliases={setColumnAliases}
        />

        <ResultsDisplay
          results={results}
          onExport={handleExport}
          isLoading={isLoading}
          executionSummary={executionSummary}
          columnAliases={columnAliases}
          dimensionMappings={dimensionMappings}
          queries={queries}
        />
      </div>
    </div>
  );
};

// Wrapper
const SmartQueryExecutor = () => {
  const apiUrl = import.meta.env.VITE_CUBEJS_API_URL;
  const token = import.meta.env.VITE_CUBEJS_TOKEN;

  if (!apiUrl || !token) {
    return (
      <div className="error-container">
        <Alert
          message="Configuration Error"
          description="Please set VITE_CUBEJS_API_URL and VITE_CUBEJS_TOKEN in your .env file"
          type="error"
          showIcon
        />
      </div>
    );
  }

  const cubeApi = cubejs(token, { apiUrl });

  return (
    <CubeProvider cubeApi={cubeApi}>
      <SmartQueryExecutorContent cubeApi={cubeApi} />
    </CubeProvider>
  );
};

export default SmartQueryExecutor;