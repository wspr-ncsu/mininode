import pandas as pd
import numpy as np
import plotly.graph_objects as go

filename = '../data/fixed-measurement-package.csv'
data = pd.read_csv(filename).query('declaredDependencyCount == 0 or (declaredDependencyCount > 0 and installedTotalDependencyCount > 0)')
print(data.size)
data = data.sort_values(by=['declaredDependencyCount'])

declared = data['declaredDependencyCount'].value_counts(normalize=True).sort_index()*100
unique = data['installedUniqueDependencyCount'].value_counts(normalize=True).sort_index()*100
total = data['installedTotalDependencyCount'].value_counts(normalize=True).sort_index()*100

declared = declared.cumsum()
unique = unique.cumsum()
total = total.cumsum()

print(declared)
print(unique)
print(total)

# # Create traces
fig = go.Figure()
fig.add_trace(go.Scatter(x=declared.keys(), y=declared,
                    mode='lines',
                    name='Declared dependency', 
                    hoverinfo='none'))
# fig.add_trace(go.Scatter(x=unique.keys(), y=unique,
#                     mode='markers+lines',
#                     name='Installed unique dependencies', 
#                     hoverinfo='none',
#                     marker={"size":4}
#                     ))
fig.add_trace(go.Scatter(x=total.keys(), y=total,
                    mode='lines+markers',
                    name='Installed total dependencies', 
                    hoverinfo='none',
                    marker={"size":3}))

fig.update_layout(title="Declared versus installed packages", xaxis={"title": "Number of packages"}, yaxis={"title": "Cumulative sum of counts"})
fig.show()