import pandas as pd
import numpy as np
import plotly.graph_objects as go

filename = '../data/fixed-measurement-package.csv'

data = pd.read_csv(filename).query('declaredDependencyCount == 0 or (declaredDependencyCount > 0 and installedTotalDependencyCount > 0)')

data = data.sort_values(by=['declaredDependencyCount'])

declared = data['declaredDependencyCount']
total = data['installedTotalDependencyCount']
print(data)
print(declared)
print(total)

# # Create traces
fig = go.Figure()
fig.add_trace(go.Scatter(x=total, y=declared,
                    mode='markers',
                    marker={"size": 3, "symbol": "cross"},
                    hoverinfo='none'))

fig.update_layout(title='Declared Dependencies versus Installed Dependencies', xaxis={"title":"Installed Dependencies"}, yaxis={"title":"Declared Dependencies"})

fig.show()